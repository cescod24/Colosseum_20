import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const decideInputSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

const DELIVERED_DELAY_MS = 8_000;

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getDemoRole();
  if (role !== "procurement") {
    return NextResponse.json(
      { error: "Procurement role required." },
      { status: 401 },
    );
  }

  const profile = await resolveProfileForRole(role);
  if (!profile || profile.role !== "procurement") {
    return NextResponse.json(
      { error: "Procurement profile not seeded." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = decideInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const supabase = getServerClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, decided_at, project_id, total, currency")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.status !== "pending" || order.decided_at !== null) {
    return NextResponse.json(
      { error: `Order is ${order.status}; cannot decide again.` },
      { status: 409 },
    );
  }

  const decidedAt = new Date().toISOString();

  if (parsed.data.action === "reject") {
    const { error: rejectError } = await supabase
      .from("orders")
      .update({
        status: "rejected",
        decided_by: profile.id,
        decided_at: decidedAt,
      })
      .eq("id", id);

    if (rejectError) {
      return NextResponse.json({ error: rejectError.message }, { status: 500 });
    }
    return NextResponse.json({ id, status: "rejected" });
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
    .eq("order_id", id);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

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
    .insert({ order_id: id, payload });

  if (handoffError) {
    return NextResponse.json({ error: handoffError.message }, { status: 500 });
  }

  console.log("[mock-comstruct] handoff", JSON.stringify(payload));

  const { error: orderedError } = await supabase
    .from("orders")
    .update({
      status: "ordered",
      decided_by: profile.id,
      decided_at: decidedAt,
    })
    .eq("id", id);

  if (orderedError) {
    return NextResponse.json({ error: orderedError.message }, { status: 500 });
  }

  scheduleDeliveredFlip(id);

  return NextResponse.json({ id, status: "ordered" });
}

function scheduleDeliveredFlip(orderId: string) {
  // Fire-and-forget. Works under `next dev` (long-running Node process); a
  // Vercel serverless deployment would need a queued job instead. Plan §
  // Phase 5 explicitly accepts this hackathon shortcut.
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
