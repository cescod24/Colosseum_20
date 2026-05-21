// Server-only helpers for the foreman home + status views. Lives here so the
// route handler (POST /api/orders) and the page server components share one
// source of truth.

import "server-only";
import type { DemoRole } from "@/lib/role";
import { getServerClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "foreman" | "procurement";
  display_name: string;
  project_id: string;
};

export type CatalogProduct = {
  id: string;
  supplier_sku: string;
  name: string;
  unit: string;
  unit_price: number;
  product_group: string | null;
  hazardous: boolean;
};

export type ForemanLastOrderLine = {
  product_id: string;
  qty: number;
  product: CatalogProduct;
};

export type ForemanLastOrder = {
  id: string;
  created_at: string;
  status: "draft" | "pending" | "approved" | "ordered" | "delivered";
  lines: ForemanLastOrderLine[];
};

export type MaterialSet = {
  id: string;
  name: string;
  items: Array<{ product: CatalogProduct; default_qty: number }>;
};

export type MostOrderedRow = {
  product: CatalogProduct;
  total_qty: number;
};

const DEMO_ROLE_TO_DISPLAY: Record<DemoRole, string> = {
  "foreman-a": "Polier A — Hochbau / PPE",
  "foreman-b": "Polier B — Werkzeug / Befestigung",
  procurement: "Procurement / Bauleiter",
};

/** Resolve the demo-cookie role to a seeded profile row. */
export async function loadProfileForRole(role: DemoRole): Promise<Profile | null> {
  const supabase = getServerClient();
  const target = DEMO_ROLE_TO_DISPLAY[role];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, project_id")
    .eq("display_name", target)
    .maybeSingle();
  if (error) {
    console.error("[foreman.loadProfileForRole]", error);
    return null;
  }
  return (data ?? null) as Profile | null;
}

export async function loadProjectCatalog(projectId: string): Promise<CatalogProduct[]> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("project_products")
    .select(
      "product:products(id, supplier_sku, name, unit, unit_price, product_group, hazardous, status)",
    )
    .eq("project_id", projectId);
  if (error) {
    console.error("[foreman.loadProjectCatalog]", error);
    return [];
  }
  type Row = { product: CatalogProduct & { status: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return rows
    .map((r) => r.product)
    .filter((p): p is CatalogProduct & { status: string } => !!p && p.status === "active")
    .map((p) => ({
      id: p.id,
      supplier_sku: p.supplier_sku,
      name: p.name,
      unit: p.unit,
      unit_price: Number(p.unit_price),
      product_group: p.product_group,
      hazardous: p.hazardous,
    }));
}

export async function loadLastOrderForForeman(
  profileId: string,
  catalog: Map<string, CatalogProduct>,
): Promise<ForemanLastOrder | null> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, items:order_items(product_id, qty)")
    .eq("created_by", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[foreman.loadLastOrderForForeman]", error);
    return null;
  }
  if (!data) return null;

  type Row = {
    id: string;
    status: ForemanLastOrder["status"];
    created_at: string;
    items: Array<{ product_id: string; qty: number }>;
  };
  const row = data as unknown as Row;
  const lines: ForemanLastOrderLine[] = [];
  for (const it of row.items) {
    const product = catalog.get(it.product_id);
    if (!product) continue;
    lines.push({ product_id: it.product_id, qty: Number(it.qty), product });
  }
  return { id: row.id, created_at: row.created_at, status: row.status, lines };
}

export async function loadMaterialSets(
  projectId: string,
  catalog: Map<string, CatalogProduct>,
): Promise<MaterialSet[]> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("material_sets")
    .select("id, name, items:material_set_items(product_id, default_qty)")
    .eq("project_id", projectId)
    .order("name");
  if (error) {
    console.error("[foreman.loadMaterialSets]", error);
    return [];
  }
  type Row = {
    id: string;
    name: string;
    items: Array<{ product_id: string; default_qty: number }>;
  };
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    items: r.items
      .map((it) => {
        const product = catalog.get(it.product_id);
        if (!product) return null;
        return { product, default_qty: Number(it.default_qty) };
      })
      .filter((x): x is { product: CatalogProduct; default_qty: number } => !!x),
  }));
}

export async function loadMostOrderedForProject(
  projectId: string,
  catalog: Map<string, CatalogProduct>,
  limit = 5,
): Promise<MostOrderedRow[]> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, items:order_items(product_id, qty)")
    .eq("project_id", projectId)
    .in("status", ["approved", "ordered", "delivered"]);
  if (error) {
    console.error("[foreman.loadMostOrderedForProject]", error);
    return [];
  }
  type Row = { items: Array<{ product_id: string; qty: number }> };
  const totals = new Map<string, number>();
  for (const r of (data ?? []) as unknown as Row[]) {
    for (const it of r.items) {
      totals.set(
        it.product_id,
        (totals.get(it.product_id) ?? 0) + Number(it.qty),
      );
    }
  }
  return Array.from(totals.entries())
    .map(([product_id, total_qty]) => {
      const product = catalog.get(product_id);
      if (!product) return null;
      return { product, total_qty };
    })
    .filter((x): x is MostOrderedRow => !!x)
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, limit);
}

export async function loadForemanOrders(profileId: string) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total, currency, created_at, items:order_items(qty, product_id)",
    )
    .eq("created_by", profileId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[foreman.loadForemanOrders]", error);
    return [];
  }
  return data ?? [];
}
