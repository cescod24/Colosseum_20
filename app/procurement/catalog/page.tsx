import { revalidatePath } from "next/cache";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";
import { productPatchInputSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

const LIMIT = 200;

type CatalogRow = {
  id: string;
  name: string;
  supplier_sku: string;
  product_group: string | null;
  unit: string;
  unit_price: number | null;
  currency: string;
  hazardous: boolean;
  status: "active" | "review";
  suppliers: { name: string };
};

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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {copyEn["catalog.title"]}
            </h1>
            <p className="text-sm text-zinc-500">
              {copyEn["catalog.subtitle"]}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm">
            {products.length} active
          </span>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_name"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_supplier"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_sku"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_group"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_unit"]}</th>
              <th className="px-4 py-2 text-right font-medium">
                {copyEn["catalog.col_price"]}
              </th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_save"]}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td colSpan={7} className="px-4 py-2">
                  <form action={updateProduct} className="grid grid-cols-12 items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      type="text"
                      name="name"
                      defaultValue={p.name}
                      aria-label={copyEn["catalog.col_name"]}
                      className="col-span-3 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <span className="col-span-2 text-zinc-600">
                      {p.suppliers.name}
                    </span>
                    <span className="col-span-1 font-mono text-xs text-zinc-500">
                      {p.supplier_sku}
                    </span>
                    <input
                      type="text"
                      name="product_group"
                      defaultValue={p.product_group ?? ""}
                      aria-label={copyEn["catalog.col_group"]}
                      className="col-span-2 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <span className="col-span-1 text-zinc-600">{p.unit}</span>
                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        name="unit_price"
                        defaultValue={p.unit_price ?? ""}
                        step="0.01"
                        min="0"
                        aria-label={copyEn["catalog.col_price"]}
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
                      />
                      <span className="text-xs text-zinc-500">{p.currency}</span>
                    </div>
                    <button
                      type="submit"
                      className="col-span-1 justify-self-end rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                    >
                      {copyEn["catalog.col_save"]}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === LIMIT && (
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
            Showing first {LIMIT} active products on this project.
          </p>
        )}
      </div>
    </section>
  );
}
