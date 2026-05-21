import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { DecideOrderLineInput } from "@/lib/schema";

// Shared decide-side logic for orders. Called by:
//   - app/api/orders/[id]/decide/route.ts  (procurement clients via POST)
//   - app/(procurement)/queue/page.tsx     (server actions from the queue UI)

const DELIVERED_DELAY_MS = 8_000;

export type DecideResult =
  | { ok: true; status: "ordered" | "rejected" }
  | { ok: false; code: number; error: string };

// Cache the probe result: the migration is either applied or not; no need to
// hit the DB on every queue render once we know. Reset to null on hot-reload.
let _lineDecisionsEnabled: boolean | null = null;

/**
 * Probes whether migration 0004 is applied on the connected DB. Lets the
 * queue UI render the legacy whole-order buttons until the migration ships,
 * so `main` keeps demoing while teammates apply the SQL.
 */
export async function lineDecisionsEnabled(): Promise<boolean> {
  if (_lineDecisionsEnabled !== null) return _lineDecisionsEnabled;
  const supabase = getServerClient();
  const { error } = await supabase
    .from("order_items")
    .select("line_status")
    .limit(1);
  _lineDecisionsEnabled = !error;
  return _lineDecisionsEnabled;
}

type OrderLine = {
  qty: number;
  unit_price: number;
  products: {
    supplier_sku: string;
    name: string;
    unit: string;
    hazardous: boolean;
    suppliers: { id: string; name: string };
  };
};

export async function approveOrder(
  orderId: string,
  procurementProfileId: string,
): Promise<DecideResult> {
  const supabase = getServerClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, decided_at, project_id, total, currency")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) return { ok: false, code: 500, error: orderError.message };
  if (!order) return { ok: false, code: 404, error: "Order not found." };
  if (order.status !== "pending" || order.decided_at !== null) {
    return {
      ok: false,
      code: 409,
      error: `Order is ${order.status}; cannot decide again.`,
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", order.project_id)
    .maybeSingle();

  const { data: itemsRaw, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "qty, unit_price, products (supplier_sku, name, unit, hazardous, suppliers (id, name))",
    )
    .eq("order_id", orderId);

  if (itemsError) return { ok: false, code: 500, error: itemsError.message };

  const items = (itemsRaw ?? []) as unknown as OrderLine[];

  const payload = {
    project_ref: {
      id: order.project_id,
      name: project?.name ?? null,
    },
    currency: order.currency,
    total: Number(order.total),
    lines: items.map((it) => ({
      supplier_id: it.products.suppliers.id,
      supplier_name: it.products.suppliers.name,
      supplier_sku: it.products.supplier_sku,
      name: it.products.name,
      unit: it.products.unit,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      currency: order.currency,
      hazardous: it.products.hazardous,
      line_total:
        Math.round(Number(it.qty) * Number(it.unit_price) * 100) / 100,
    })),
  };

  const { error: handoffError } = await supabase
    .from("mock_comstruct_orders")
    .insert({ order_id: orderId, payload });

  if (handoffError)
    return { ok: false, code: 500, error: handoffError.message };

  console.log("[mock-comstruct] handoff", JSON.stringify(payload));

  const { error: orderedError } = await supabase
    .from("orders")
    .update({
      status: "ordered",
      decided_by: procurementProfileId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (orderedError)
    return { ok: false, code: 500, error: orderedError.message };

  scheduleDeliveredFlip(orderId);
  return { ok: true, status: "ordered" };
}

export async function rejectOrder(
  orderId: string,
  procurementProfileId: string,
): Promise<DecideResult> {
  const supabase = getServerClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, decided_at")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) return { ok: false, code: 500, error: orderError.message };
  if (!order) return { ok: false, code: 404, error: "Order not found." };
  if (order.status !== "pending" || order.decided_at !== null) {
    return {
      ok: false,
      code: 409,
      error: `Order is ${order.status}; cannot decide again.`,
    };
  }

  const { error: rejectError } = await supabase
    .from("orders")
    .update({
      status: "rejected",
      decided_by: procurementProfileId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (rejectError) return { ok: false, code: 500, error: rejectError.message };
  return { ok: true, status: "rejected" };
}

type DecideLineRow = {
  id: string;
  qty: number;
  unit_price: number;
  products: {
    supplier_sku: string;
    name: string;
    unit: string;
    hazardous: boolean;
    suppliers: { id: string; name: string };
  };
};

/**
 * Per-line procurement decision. Approved lines proceed to comstruct;
 * declined lines stay on the order with a reason and (optionally) a
 * suggested replacement product for the foreman to one-tap into a new
 * Bestellung. If every line is declined the order is `rejected`,
 * otherwise it's `ordered` with the total recomputed from approved lines.
 */
export async function decideOrderLines(
  orderId: string,
  procurementProfileId: string,
  decisions: DecideOrderLineInput[],
): Promise<DecideResult> {
  const supabase = getServerClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, decided_at, project_id, currency")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) return { ok: false, code: 500, error: orderError.message };
  if (!order) return { ok: false, code: 404, error: "Order not found." };
  if (order.status !== "pending" || order.decided_at !== null) {
    return {
      ok: false,
      code: 409,
      error: `Order is ${order.status}; cannot decide again.`,
    };
  }

  const { data: itemsRaw, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, qty, unit_price, products (supplier_sku, name, unit, hazardous, suppliers (id, name))",
    )
    .eq("order_id", orderId);

  if (itemsError) return { ok: false, code: 500, error: itemsError.message };
  const items = (itemsRaw ?? []) as unknown as DecideLineRow[];

  const decisionById = new Map(decisions.map((d) => [d.order_item_id, d]));
  if (decisionById.size !== items.length) {
    return {
      ok: false,
      code: 400,
      error: "One decision per order line is required.",
    };
  }
  for (const it of items) {
    if (!decisionById.has(it.id)) {
      return {
        ok: false,
        code: 400,
        error: `Missing decision for line ${it.id}.`,
      };
    }
  }

  // Write line-level decisions first so the order detail page sees them
  // even if the comstruct handoff below fails partway through.
  for (const d of decisions) {
    const update =
      d.decision === "approve"
        ? {
            line_status: "approved",
            decline_reason: null,
            suggested_product_id: null,
            suggested_qty: null,
          }
        : {
            line_status: "rejected",
            decline_reason: d.reason,
            suggested_product_id: d.suggested_product_id ?? null,
            suggested_qty: d.suggested_qty,
          };
    const { error: lineError } = await supabase
      .from("order_items")
      .update(update)
      .eq("id", d.order_item_id)
      .eq("order_id", orderId);
    if (lineError) return { ok: false, code: 500, error: lineError.message };
  }

  const approvedItems = items.filter(
    (it) => decisionById.get(it.id)?.decision === "approve",
  );

  if (approvedItems.length === 0) {
    const { error: rejectError } = await supabase
      .from("orders")
      .update({
        status: "rejected",
        decided_by: procurementProfileId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    if (rejectError)
      return { ok: false, code: 500, error: rejectError.message };
    return { ok: true, status: "rejected" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", order.project_id)
    .maybeSingle();

  const newTotal =
    Math.round(
      approvedItems.reduce(
        (sum, it) => sum + Number(it.qty) * Number(it.unit_price),
        0,
      ) * 100,
    ) / 100;

  const payload = {
    project_ref: {
      id: order.project_id,
      name: project?.name ?? null,
    },
    currency: order.currency,
    total: newTotal,
    lines: approvedItems.map((it) => ({
      supplier_id: it.products.suppliers.id,
      supplier_name: it.products.suppliers.name,
      supplier_sku: it.products.supplier_sku,
      name: it.products.name,
      unit: it.products.unit,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      currency: order.currency,
      hazardous: it.products.hazardous,
      line_total:
        Math.round(Number(it.qty) * Number(it.unit_price) * 100) / 100,
    })),
    partial: approvedItems.length < items.length,
  };

  const { error: handoffError } = await supabase
    .from("mock_comstruct_orders")
    .insert({ order_id: orderId, payload });
  if (handoffError)
    return { ok: false, code: 500, error: handoffError.message };

  console.log("[mock-comstruct] handoff", JSON.stringify(payload));

  const { error: orderedError } = await supabase
    .from("orders")
    .update({
      status: "ordered",
      total: newTotal,
      decided_by: procurementProfileId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (orderedError)
    return { ok: false, code: 500, error: orderedError.message };

  scheduleDeliveredFlip(orderId);
  return { ok: true, status: "ordered" };
}

function scheduleDeliveredFlip(orderId: string) {
  // Fire-and-forget. Works under `next dev` (long-running Node); a Vercel
  // serverless deploy would need a queued job. Plan §Phase 5 accepts this.
  setTimeout(() => {
    void (async () => {
      try {
        const supabase = getServerClient();
        const { error } = await supabase
          .from("orders")
          .update({ status: "delivered" })
          .eq("id", orderId)
          .eq("status", "ordered");
        if (error) {
          console.warn("[delivered-flip] failed", orderId, error.message);
        }
      } catch (err) {
        console.warn("[delivered-flip] threw", orderId, err);
      }
    })();
  }, DELIVERED_DELAY_MS);
}
