import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";
import { SpendBar, type Datum } from "./DashboardCharts";

export const dynamic = "force-dynamic";

const COUNTED_STATUSES = ["pending", "approved", "ordered", "delivered"];
const TOP_N_SUPPLIERS = 8;

type Row = {
  qty: number;
  unit_price: number;
  orders: {
    created_by: string;
    profiles: { display_name: string } | null;
  };
  products: {
    product_group: string | null;
    suppliers: { name: string };
  };
};

function fmtCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function DashboardPage() {
  const role = await getDemoRole();
  const profile = role ? await resolveProfileForRole(role) : null;

  if (!profile?.project_id) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["dashboard.title"]}
        </h1>
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {copyEn["project.missing"]}
        </p>
      </section>
    );
  }

  const supabase = getServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("name, currency")
    .eq("id", profile.project_id)
    .maybeSingle();

  const currency = (project?.currency as string) ?? "CHF";

  const { data: rowsRaw, error } = await supabase
    .from("order_items")
    .select(
      "qty, unit_price, orders!inner (created_by, project_id, status, profiles!orders_created_by_fkey (display_name)), products (product_group, suppliers (name))",
    )
    .eq("orders.project_id", profile.project_id)
    .in("orders.status", COUNTED_STATUSES);

  if (error) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["dashboard.title"]}
        </h1>
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </p>
      </section>
    );
  }

  const rows = (rowsRaw ?? []) as unknown as Row[];

  const round = (n: number) => Math.round(n * 100) / 100;

  const supplierMap = new Map<string, number>();
  const groupMap = new Map<string, number>();
  const foremanMap = new Map<string, { name: string; spend: number }>();
  let total = 0;

  for (const r of rows) {
    const spend = Number(r.qty) * Number(r.unit_price);
    total += spend;

    const supplier = r.products?.suppliers?.name ?? "—";
    supplierMap.set(supplier, (supplierMap.get(supplier) ?? 0) + spend);

    const group = r.products?.product_group ?? "—";
    groupMap.set(group, (groupMap.get(group) ?? 0) + spend);

    const fid = r.orders.created_by;
    const fname = r.orders.profiles?.display_name ?? "—";
    const prev = foremanMap.get(fid);
    foremanMap.set(fid, {
      name: fname,
      spend: (prev?.spend ?? 0) + spend,
    });
  }

  const supplierData: Datum[] = Array.from(supplierMap.entries())
    .map(([label, spend]) => ({ label, spend: round(spend) }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, TOP_N_SUPPLIERS);

  const groupData: Datum[] = Array.from(groupMap.entries())
    .map(([label, spend]) => ({ label, spend: round(spend) }))
    .sort((a, b) => b.spend - a.spend);

  const foremanData = Array.from(foremanMap.values())
    .map((f) => ({ name: f.name, spend: round(f.spend) }))
    .sort((a, b) => b.spend - a.spend);

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["dashboard.title"]}
        </h1>
        <p className="text-sm text-zinc-500">
          {project?.name ?? ""} · {copyEn["dashboard.subtitle"]} ·{" "}
          {fmtCurrency(round(total), currency)} total
        </p>
      </header>

      <article className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          {copyEn["dashboard.by_supplier"]}
        </h2>
        <SpendBar data={supplierData} currency={currency} />
      </article>

      <article className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          {copyEn["dashboard.by_group"]}
        </h2>
        <SpendBar data={groupData} currency={currency} />
      </article>

      <article className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          {copyEn["dashboard.by_foreman"]}
        </h2>
        {foremanData.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 font-medium">{copyEn["dashboard.foreman"]}</th>
                <th className="py-2 text-right font-medium">
                  {copyEn["dashboard.spend"]}
                </th>
              </tr>
            </thead>
            <tbody>
              {foremanData.map((f) => (
                <tr key={f.name} className="border-t border-zinc-100">
                  <td className="py-2 text-zinc-900">{f.name}</td>
                  <td className="py-2 text-right font-medium text-zinc-900">
                    {fmtCurrency(f.spend, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
