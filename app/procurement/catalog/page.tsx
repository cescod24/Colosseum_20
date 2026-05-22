import { revalidatePath } from "next/cache";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";
import { productPatchInputSchema } from "@/lib/schema";
import { CatalogTable, type CatalogRow } from "./CatalogTable";

export const dynamic = "force-dynamic";

// Server-side search returns at most this many rows per query — the catalog
// can hold tens of thousands of products, so we never ship them all to the
// client. The total count is shown separately; narrowing happens via ?q=.
const RESULT_LIMIT = 100;

// Strip characters that would break a PostgREST .or() filter string.
function sanitizeQuery(q: string): string {
  return q.replace(/[%,()*:\\]/g, " ").trim().slice(0, 80);
}

async function updateProduct(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const role = await getDemoRole();
  if (role !== "procurement") return;

  const nameRaw = String(formData.get("name") ?? "").trim();
  const groupRaw = String(formData.get("product_group") ?? "").trim();
  const priceRaw = String(formData.get("unit_price") ?? "").trim();

  const patch: Record<string, unknown> = {};
  if (nameRaw.length > 0) patch.name = nameRaw;
  if (groupRaw.length > 0) patch.product_group = groupRaw;
  if (priceRaw.length > 0) {
    const n = Number(priceRaw);
    if (Number.isFinite(n) && n > 0) patch.unit_price = n;
  }

  const parsed = productPatchInputSchema.safeParse(patch);
  if (!parsed.success) return;

  const supabase = getServerClient();
  await supabase.from("products").update(parsed.data).eq("id", id);
  revalidatePath("/procurement/catalog");
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const role = await getDemoRole();
  const profile = role ? await resolveProfileForRole(role) : null;

  if (!profile?.project_id) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["catalog.title"]}
        </h1>
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {copyEn["project.missing"]}
        </p>
      </section>
    );
  }

  const { q: qRaw } = await searchParams;
  const query = sanitizeQuery((qRaw ?? "").toString());

  const supabase = getServerClient();

  // Inner-join project_products so the catalog scopes to this project, then
  // ILIKE-filter on name / SKU / group. Scales to tens of thousands without
  // round-tripping a million ids through the client.
  let q = supabase
    .from("products")
    .select(
      "id, name, supplier_sku, product_group, unit, unit_price, currency, hazardous, status, suppliers (name), project_products!inner(project_id)",
      { count: "exact" },
    )
    .eq("project_products.project_id", profile.project_id)
    .eq("status", "active");

  if (query.length > 0) {
    const pat = `%${query}%`;
    q = q.or(
      `name.ilike.${pat},supplier_sku.ilike.${pat},product_group.ilike.${pat}`,
    );
  }

  const { data: productsRaw, count, error } = await q
    .order("name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["catalog.title"]}
        </h1>
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </p>
      </section>
    );
  }

  const products = (productsRaw ?? []) as unknown as CatalogRow[];
  const total = count ?? products.length;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Procurement
        </p>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {copyEn["catalog.title"]}
          </h1>
          <p className="text-sm text-zinc-500">{copyEn["catalog.subtitle"]}</p>
        </div>
      </header>

      <CatalogTable
        products={products}
        total={total}
        query={query}
        resultLimit={RESULT_LIMIT}
        updateProduct={updateProduct}
      />
    </section>
  );
}
