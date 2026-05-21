import "server-only";
import { getServerClient } from "@/lib/supabase/server";

// Shared decide-side logic for orders. Called by:
//   - app/api/orders/[id]/decide/route.ts  (procurement clients via POST)
//   - app/(procurement)/queue/page.tsx     (server actions from the queue UI)

const DELIVERED_DELAY_MS = 8_000;

export type DecideResult =
  | { ok: true; status: "ordered" | "rejected" }
  | { ok: false; code: number; error: string };

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
