import { NextResponse } from "next/server";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { submitOrderInputSchema } from "@/lib/schema";
import { decide, type RuleItem, type Rules } from "@/lib/rules";

export const runtime = "nodejs";

type ProductRow = {
  id: string;
  product_group: string | null;
  hazardous: boolean;
  unit_price: number | null;
  status: "active" | "review";
};

export async function POST(request: Request) {
  const role = await getDemoRole();
  if (role !== "foreman-a" && role !== "foreman-b") {
    return NextResponse.json({ error: "Not a foreman role." }, { status: 401 });
  }

  const profile = await resolveProfileForRole(role);
  if (!profile || profile.role !== "foreman" || !profile.project_id) {
    return NextResponse.json(
      { error: "Foreman profile not seeded for this role." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = submitOrderInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getServerClient();
  const productIds = parsed.data.items.map((it) => it.product_id);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, product_group, hazardous, unit_price, status")
    .in("id", productIds);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const byId = new Map<string, ProductRow>(
    (products ?? []).map((p) => [p.id, p as ProductRow]),
  );

  for (const id of productIds) {
    const row = byId.get(id);
    if (!row) {
      return NextResponse.json(
        { error: `Unknown product ${id}.` },
        { status: 400 },
      );
    }
    if (row.status !== "active") {
      return NextResponse.json(
        { error: `Product ${id} is not active.` },
        { status: 400 },
      );
    }
    if (row.unit_price === null) {
      return NextResponse.json(
        { error: `Product ${id} has no unit_price.` },
        { status: 400 },
      );
    }
  }

  let total = 0;
  const ruleItems: RuleItem[] = [];
  for (const line of parsed.data.items) {
    const row = byId.get(line.product_id)!;
    total += Number(row.unit_price) * line.qty;
    ruleItems.push({ product_group: row.product_group, hazardous: row.hazardous });
  }
  total = Math.round(total * 100) / 100;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, auto_approve_threshold, currency")
    .eq("id", profile.project_id)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json(
      { error: "Project not found for foreman." },
      { status: 500 },
    );
  }

  const { data: rulesRow } = await supabase
    .from("approval_rules")
    .select("restricted_groups")
    .eq("project_id", profile.project_id)
    .maybeSingle();

  const rules: Rules = {
    threshold: Number(project.auto_approve_threshold),
    restricted_groups: (rulesRow?.restricted_groups ?? []) as string[],
  };

  const status = decide(total, ruleItems, rules);

  const { data: inserted, error: orderError } = await supabase
    .from("orders")
    .insert({
      project_id: profile.project_id,
      created_by: profile.id,
      status,
      total,
      currency: project.currency,
    })
    .select("id, status, total, currency")
    .single();

  if (orderError || !inserted) {
    return NextResponse.json(
      { error: orderError?.message ?? "Failed to create order." },
      { status: 500 },
    );
  }

  const itemsRows = parsed.data.items.map((line) => ({
    order_id: inserted.id,
    product_id: line.product_id,
    qty: line.qty,
    unit_price: Number(byId.get(line.product_id)!.unit_price),
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsRows);

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", inserted.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
