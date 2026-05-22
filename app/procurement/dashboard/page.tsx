import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";
import { RefreshPoller } from "@/components/RefreshPoller";
import { SpendBar, type Datum } from "./DashboardCharts";

export const dynamic = "force-dynamic";

const COUNTED_STATUSES = ["pending", "approved", "ordered", "delivered"];
const TOP_N_SUPPLIERS = 8;

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-sky-100 text-sky-800",
  ordered: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {status}
    </span>
  );
}

function fmtDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("en-CH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
}

type RecapRow = {
  id: string;
  status: string;
  total: number | string;
  currency: string | null;
  created_at: string;
  decided_at: string | null;
  profiles: { display_name: string } | null;
  order_items: { qty: number }[] | null;
};

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
      "qty, unit_price, orders!inner (created_by, project_id, status, profiles!orders_created_by_fkey (display_name)), products!order_items_product_id_fkey (product_group, suppliers (name))",
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

  // Decision recap: every order and where it landed (incl. rejected / draft),
  // which the spend rollups above deliberately exclude.
  const { data: recapRaw } = await supabase
    .from("orders")
    .select(
      "id, status, total, currency, created_at, decided_at, profiles!orders_created_by_fkey (display_name), order_items (qty)",
    )
    .eq("project_id", profile.project_id)
    .order("created_at", { ascending: false })
    .limit(40);
  const recap = (recapRaw ?? []) as unknown as RecapRow[];

  return (
    <section className="space-y-8">
      <RefreshPoller intervalMs={3000} />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["dashboard.title"]}
        </h1>
        <p className="text-sm text-zinc-500">
          {project?.name ?? ""} · {copyEn["dashboard.subtitle"]} ·{" "}
          {fmtCurrency(round(total), currency)} total
        </p>
      </header>

      <article className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="mt-0.5 h-2 w-2 flex-none rounded-full bg-amber-500"></div>
        <div className="flex-1 space-y-1">
          <p className="font-semibold">{copyEn["dashboard.alert_title"]}</p>
          <p>{copyEn["dashboard.alert_body"]}</p>
        </div>
        <a
          href="/procurement/queue"
          className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:border-amber-500"
        >
          {copyEn["dashboard.alert_cta"]}
        </a>
      </article>

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

      <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <header className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Decision recap
          </h2>
          <p className="text-xs text-zinc-500">
            Every order and where it landed — approved, rejected, in transit,
            delivered.
          </p>
        </header>
        {recap.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-400">
            No orders yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-2 font-medium">Order</th>
                <th className="px-5 py-2 font-medium">Foreman</th>
                <th className="px-5 py-2 text-right font-medium">Items</th>
                <th className="px-5 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Submitted</th>
                <th className="px-5 py-2 font-medium">Decided</th>
              </tr>
            </thead>
            <tbody>
              {recap.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100">
                  <td className="px-5 py-2 font-mono text-xs text-zinc-500">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="px-5 py-2 text-zinc-700">
                    {o.profiles?.display_name ?? "—"}
                  </td>
                  <td className="px-5 py-2 text-right text-zinc-700">
                    {(o.order_items ?? []).length}
                  </td>
                  <td className="px-5 py-2 text-right font-medium text-zinc-900">
                    {fmtCurrency(Number(o.total) || 0, o.currency ?? currency)}
                  </td>
                  <td className="px-5 py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-2 text-zinc-500">
                    {fmtDate(o.created_at)}
                  </td>
                  <td className="px-5 py-2 text-zinc-500">
                    {fmtDate(o.decided_at)}
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
