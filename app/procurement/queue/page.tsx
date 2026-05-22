import { revalidatePath } from "next/cache";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import {
  approveOrder,
  lineDecisionsEnabled,
  rejectOrder,
} from "@/lib/server/orders";
import { copyEn } from "@/lib/constants/copy.en";
import { RefreshPoller } from "@/components/RefreshPoller";
import {
  OrderDecisionForm,
  type QueueLineProp,
  type SuggestionOption,
} from "./OrderDecisionForm";

// Live: re-fetch the pending queue every 3s so new foreman submissions
// appear without a manual refresh.
export const dynamic = "force-dynamic";

type QueueLine = {
  id: string;
  qty: number;
  unit_price: number;
  products: {
    name: string;
    unit: string;
    hazardous: boolean;
    suppliers: { name: string };
  };
};

type QueueOrder = {
  id: string;
  total: number;
  currency: string;
  created_at: string;
  profiles: { display_name: string } | null;
  order_items: QueueLine[];
};

const fmtCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-CH", { style: "currency", currency }).format(value);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

async function approveAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;
  const role = await getDemoRole();
  if (role !== "procurement") return;
  const profile = await resolveProfileForRole(role);
  if (!profile) return;
  await approveOrder(orderId, profile.id);
  revalidatePath("/procurement/queue");
}

async function rejectAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;
  const role = await getDemoRole();
  if (role !== "procurement") return;
  const profile = await resolveProfileForRole(role);
  if (!profile) return;
  await rejectOrder(orderId, profile.id);
  revalidatePath("/procurement/queue");
}

export default async function QueuePage() {
  const supabase = getServerClient();
  const role = await getDemoRole();
  const profile = role ? await resolveProfileForRole(role) : null;

  const linesEnabled = await lineDecisionsEnabled();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, total, currency, created_at, profiles!orders_created_by_fkey (display_name), order_items (id, qty, unit_price, products!order_items_product_id_fkey (name, unit, hazardous, suppliers (name)))",
    )
    .eq("status", "pending")
    .is("decided_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {error.message}
      </p>
    );
  }

  const orders = (data ?? []) as unknown as QueueOrder[];

  // Build the suggestion catalog once (shared across all queue rows).
  let suggestions: SuggestionOption[] = [];
  if (linesEnabled && profile?.project_id) {
    const { data: linkRows } = await supabase
      .from("project_products")
      .select("product_id")
      .eq("project_id", profile.project_id);
    const ids = (linkRows ?? []).map((r) => r.product_id as string);
    if (ids.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name, unit, suppliers (name)")
        .in("id", ids)
        .eq("status", "active")
        .order("name", { ascending: true });
      suggestions = ((productRows ?? []) as unknown as Array<{
        id: string;
        name: string;
        unit: string;
        suppliers: { name: string };
      }>).map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        supplierName: p.suppliers?.name ?? "",
      }));
    }
  }

  const pendingValue = orders.reduce(
    (sum, o) => sum + Number(o.total),
    0,
  );
  const pendingCurrency = orders[0]?.currency ?? "CHF";

  return (
    <section className="space-y-6">
      <RefreshPoller intervalMs={1000} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Procurement
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {copyEn["queue.title"]}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {orders.length} pending
          </span>
          {orders.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700">
              {fmtCurrency(
                Math.round(pendingValue * 100) / 100,
                pendingCurrency,
              )}{" "}
              value
            </span>
          )}
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
          <p className="text-sm text-zinc-500">{copyEn["queue.empty"]}</p>
          <p className="mt-2 text-xs text-zinc-400">
            Auto-refreshes every second — new submissions appear here live.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {copyEn["queue.col_foreman"]}
                  </p>
                  <p className="font-medium text-zinc-900">
                    {order.profiles?.display_name ?? "unknown"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {copyEn["queue.col_items"]}
                  </p>
                  <p className="font-medium text-zinc-900">
                    {order.order_items.length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {copyEn["queue.col_total"]}
                  </p>
                  <p className="font-semibold text-zinc-900">
                    {fmtCurrency(Number(order.total), order.currency)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {copyEn["queue.col_submitted"]}
                  </p>
                  <p className="text-sm text-zinc-700">
                    {fmtDate(order.created_at)}
                  </p>
                </div>
                {!linesEnabled && (
                  <div className="flex items-center gap-2">
                    <form action={approveAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                      >
                        {copyEn["queue.approve"]}
                      </button>
                    </form>
                    <form action={rejectAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                      >
                        {copyEn["queue.reject"]}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {linesEnabled ? (
                <OrderDecisionForm
                  orderId={order.id}
                  currency={order.currency}
                  lines={order.order_items.map<QueueLineProp>((line) => ({
                    id: line.id,
                    qty: Number(line.qty),
                    unitPrice: Number(line.unit_price),
                    productName: line.products.name,
                    unit: line.products.unit,
                    supplierName: line.products.suppliers.name,
                    hazardous: line.products.hazardous,
                  }))}
                  suggestions={suggestions}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-5 py-2 font-medium">Product</th>
                      <th className="px-5 py-2 font-medium">Supplier</th>
                      <th className="px-5 py-2 text-right font-medium">
                        {copyEn["queue.line_qty"]}
                      </th>
                      <th className="px-5 py-2 text-right font-medium">
                        {copyEn["queue.line_unit_price"]}
                      </th>
                      <th className="px-5 py-2 text-right font-medium">
                        {copyEn["queue.line_total"]}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((line) => {
                      const lineTotal =
                        Math.round(
                          Number(line.qty) * Number(line.unit_price) * 100,
                        ) / 100;
                      return (
                        <tr
                          key={line.id}
                          className="border-t border-zinc-100"
                        >
                          <td className="px-5 py-2">
                            <span className="text-zinc-900">
                              {line.products.name}
                            </span>
                            {line.products.hazardous && (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                {copyEn["queue.hazardous_flag"]}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-zinc-600">
                            {line.products.suppliers.name}
                          </td>
                          <td className="px-5 py-2 text-right text-zinc-700">
                            {Number(line.qty)} {line.products.unit}
                          </td>
                          <td className="px-5 py-2 text-right text-zinc-700">
                            {fmtCurrency(
                              Number(line.unit_price),
                              order.currency,
                            )}
                          </td>
                          <td className="px-5 py-2 text-right font-medium text-zinc-900">
                            {fmtCurrency(lineTotal, order.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
