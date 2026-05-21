// POST /api/orders
//
// Minimal Phase 4 contract used by the foreman cart submit. Dev B's Phase 4
// commit will replace/extend this with the full rules engine + unit tests +
// comstruct handoff scaffolding. For now we already:
//   * trust nothing from the client beyond { product_id, qty }
//   * resolve the calling profile via the demo cookie
//   * fetch authoritative unit_price + hazardous flags server-side
//   * compute total, call decide(), INSERT orders + order_items
//   * return the assigned status
//
// All server-only — uses the SERVICE-ROLE supabase client.

import { NextResponse } from "next/server";

import { submitOrderInputSchema } from "@/lib/schema";
import { decide, type RuleItem, type Rules } from "@/lib/rules";
import { getDemoRole } from "@/lib/role";
import { loadProfileForRole } from "@/lib/data/foreman";
import { getServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const role = await getDemoRole();
  if (!role || role === "procurement") {
    return NextResponse.json({ error: "no foreman role" }, { status: 401 });
  }
  const profile = await loadProfileForRole(role);
  if (!profile) {
    return NextResponse.json({ error: "no profile" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = submitOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = getServerClient();
  const productIds = parsed.data.items.map((i) => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, unit_price, product_group, hazardous, status")
    .in("id", productIds);
  if (prodErr) {
    console.error("[api/orders] fetch products", prodErr);
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }
  type ProdRow = {
    id: string;
    unit_price: number;
    product_group: string | null;
    hazardous: boolean;
    status: string;
  };
  const productById = new Map<string, ProdRow>(
    ((products ?? []) as ProdRow[]).map((p) => [p.id, p]),
  );

  const ruleItems: RuleItem[] = [];
  let total = 0;
  const lineInserts: Array<{
    product_id: string;
    qty: number;
    unit_price: number;
  }> = [];
  for (const item of parsed.data.items) {
    const p = productById.get(item.product_id);
    if (!p) {
      return NextResponse.json(
        { error: `unknown product ${item.product_id}` },
        { status: 400 },
      );
    }
    if (p.status !== "active") {
      return NextResponse.json(
        { error: `product not active: ${item.product_id}` },
        { status: 400 },
      );
    }
    total += Number(p.unit_price) * item.qty;
    ruleItems.push({ product_group: p.product_group, hazardous: p.hazardous });
    lineInserts.push({
      product_id: item.product_id,
      qty: item.qty,
      unit_price: Number(p.unit_price),
    });
  }

  const { data: rulesRow, error: rulesErr } = await supabase
    .from("approval_rules")
    .select("threshold, restricted_groups")
    .eq("project_id", profile.project_id)
    .maybeSingle();
  if (rulesErr) {
    console.error("[api/orders] fetch rules", rulesErr);
    return NextResponse.json({ error: rulesErr.message }, { status: 500 });
  }
  const rules: Rules = {
    threshold: rulesRow ? Number(rulesRow.threshold) : 200,
    restricted_groups: (rulesRow?.restricted_groups as string[] | null) ?? [],
  };
  const status = decide(total, ruleItems, rules);

  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .insert({
      project_id: profile.project_id,
      created_by: profile.id,
      status,
      total: Math.round(total * 100) / 100,
      currency: "CHF",
    })
    .select("id, status")
    .single();
  if (orderErr || !orderRow) {
    console.error("[api/orders] insert order", orderErr);
    return NextResponse.json(
      { error: orderErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(lineInserts.map((l) => ({ ...l, order_id: orderRow.id })));
  if (itemsErr) {
    console.error("[api/orders] insert items", itemsErr);
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({
    order_id: orderRow.id,
    status: orderRow.status,
    total: Math.round(total * 100) / 100,
  });
}
