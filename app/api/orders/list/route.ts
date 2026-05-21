import { NextResponse } from "next/server";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";

// GET /api/orders/list — 3 s polling fallback for the foreman's orders page.
// Slice A's OrdersListClient subscribes via Supabase Realtime first and only
// merges this endpoint's results if it returns 200. Response shape mirrors
// `OrderSummary` in app/foreman/_components/OrdersListClient.tsx:12-19.

export const runtime = "nodejs";

const MAX_ROWS = 50;

type RawOrder = {
  id: string;
  status: string;
  total: number | string;
  currency: string;
  created_at: string;
  order_items: Array<{
    qty: number | string;
    product_id: string;
    line_status?: string | null;
    decline_reason?: string | null;
    suggested_product_id?: string | null;
  }> | null;
};

export async function GET() {
  const role = await getDemoRole();
  if (!role) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const profile = await resolveProfileForRole(role);
  if (!profile) {
    return NextResponse.json(
      { error: "Profile not seeded for this role." },
      { status: 400 },
    );
  }

  const supabase = getServerClient();
  const richSelect =
    "id, status, total, currency, created_at, order_items (qty, product_id, line_status, decline_reason, suggested_product_id)";
  const legacySelect =
    "id, status, total, currency, created_at, order_items (qty, product_id)";

  const runQuery = (select: string) => {
    let q = supabase
      .from("orders")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (profile.role === "foreman") {
      q = q.eq("created_by", profile.id);
    } else if (profile.project_id) {
      q = q.eq("project_id", profile.project_id);
    }
    return q;
  };

  let { data, error } = await runQuery(richSelect);
  if (error) {
    ({ data, error } = await runQuery(legacySelect));
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const orders = ((data ?? []) as unknown as RawOrder[]).map((raw) => {
    const r = raw;
    const items = (r.order_items ?? []).map((it) => ({
      qty: Number(it.qty),
      product_id: it.product_id,
      line_status: (it.line_status ?? null) as "approved" | "rejected" | null,
      decline_reason: it.decline_reason ?? null,
      suggested_product_id: it.suggested_product_id ?? null,
    }));
    return {
      id: r.id,
      status: r.status,
      total: Number(r.total),
      currency: r.currency,
      created_at: r.created_at,
      items,
    };
  });

  return NextResponse.json({ orders });
}
