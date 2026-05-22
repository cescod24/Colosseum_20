import { revalidatePath } from "next/cache";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";
import { productPatchInputSchema } from "@/lib/schema";
import { CatalogTable, type CatalogRow } from "./CatalogTable";

export const dynamic = "force-dynamic";

const LIMIT = 200;

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

export default async function CatalogPage() {
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

  const supabase = getServerClient();

  const { data: linkRows } = await supabase
    .from("project_products")
    .select("product_id")
    .eq("project_id", profile.project_id);

  const ids = (linkRows ?? []).map((r) => r.product_id as string);

  if (ids.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["catalog.title"]}
        </h1>
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {copyEn["catalog.empty"]}
        </p>
      </section>
    );
  }

  const { data: productsRaw, error } = await supabase
    .from("products")
    .select(
      "id, name, supplier_sku, product_group, unit, unit_price, currency, hazardous, status, suppliers (name)",
    )
    .in("id", ids)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(LIMIT);

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
        limit={LIMIT}
        updateProduct={updateProduct}
      />
    </section>
  );
}
