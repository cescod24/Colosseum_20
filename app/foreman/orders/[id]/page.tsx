import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { lineDecisionsEnabled } from "@/lib/server/orders";
import { copyDe } from "@/lib/constants/copy.de";
import { StatusPill, type OrderStatus } from "@/app/foreman/_components/StatusPill";
import { ConfirmDeliveryCard } from "./ConfirmDeliveryCard";
import { LineDecisionsList, type LineRow } from "./LineDecisionsList";

export const dynamic = "force-dynamic";

type ProductRef = {
  name: string;
  unit: string;
};

type OrderLine = {
  id: string;
  qty: number;
  line_status?: "approved" | "rejected" | null;
  decline_reason?: string | null;
  suggested_qty?: number | string | null;
  products: ProductRef;
  suggested_product?: ProductRef | null;
};

type OrderRow = {
  id: string;
  status: OrderStatus;
  total: number;
  currency: string;
  created_at: string;
  created_by: string;
  order_items: OrderLine[];
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default async function ForemanOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getDemoRole();
  if (!role || role === "procurement") redirect("/");

  const profile = await resolveProfileForRole(role);
  if (!profile || profile.role !== "foreman") redirect("/");

  const { id } = await params;
  const supabase = getServerClient();
  const linesEnabled = await lineDecisionsEnabled();

  const select = linesEnabled
    ? "id, status, total, currency, created_at, created_by, order_items (id, qty, line_status, decline_reason, suggested_qty, products!order_items_product_id_fkey (name, unit), suggested_product:products!order_items_suggested_product_id_fkey (name, unit))"
    : "id, status, total, currency, created_at, created_by, order_items (id, qty, products!order_items_product_id_fkey (name, unit))";

  const { data, error } = await supabase
    .from("orders")
    .select(select)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const order = data as unknown as OrderRow;
  if (order.created_by !== profile.id) redirect("/foreman/orders");

  const canConfirm = order.status === "ordered" || order.status === "approved";
  const alreadyDelivered = order.status === "delivered";

  const lineRows: LineRow[] = order.order_items.map((line) => {
    const suggestedQty =
      line.suggested_qty === null || line.suggested_qty === undefined
        ? null
        : Number(line.suggested_qty);
    return {
      id: line.id,
      productName: line.products.name,
      unit: line.products.unit,
      qty: Number(line.qty),
      lineStatus: (line.line_status ?? "approved") as "approved" | "rejected",
      declineReason: line.decline_reason ?? null,
      suggested:
        line.suggested_product && suggestedQty && suggestedQty > 0
          ? {
              productId: "",
              name: line.suggested_product.name,
              unit: line.suggested_product.unit,
              qty: suggestedQty,
            }
          : null,
    };
  });

  // The client needs the suggested_product_id, which Supabase joins return
  // as the row id of the joined product. Pull it through a separate select
  // keyed on order_id so the relational join name stays simple above.
  if (linesEnabled) {
    const { data: ids } = await supabase
      .from("order_items")
      .select("id, suggested_product_id")
      .eq("order_id", id);
    const map = new Map<string, string>(
      ((ids ?? []) as Array<{ id: string; suggested_product_id: string | null }>)
        .filter((r) => r.suggested_product_id)
        .map((r) => [r.id, r.suggested_product_id as string]),
    );
    for (const row of lineRows) {
      if (row.suggested) {
        row.suggested.productId = map.get(row.id) ?? "";
      }
      if (row.suggested && !row.suggested.productId) {
        row.suggested = null;
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-12 pt-4">
      <header className="flex items-center gap-2">
        <Link
          href="/foreman/orders"
          className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 hover:border-zinc-400"
          aria-label={copyDe["orders.title"]}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-zinc-900">
            {copyDe["order_detail.title"]} #{order.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-zinc-500">
            {fmtDate(order.created_at)} · {Number(order.total).toFixed(2)}{" "}
            {order.currency}
          </p>
        </div>
      </header>

      <StatusPill status={order.status} />

      <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-zinc-900">
          {copyDe["order_detail.lines"]}
        </p>
        <LineDecisionsList lines={lineRows} />
      </section>

      {(canConfirm || alreadyDelivered) && (
        <ConfirmDeliveryCard
          orderId={order.id}
          alreadyDelivered={alreadyDelivered}
        />
      )}
    </div>
  );
}
