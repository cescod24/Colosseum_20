import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyDe } from "@/lib/constants/copy.de";
import { StatusPill, type OrderStatus } from "@/app/foreman/_components/StatusPill";
import { ConfirmDeliveryCard } from "./ConfirmDeliveryCard";

export const dynamic = "force-dynamic";

type OrderLine = {
  qty: number;
  products: {
    name: string;
    unit: string;
  };
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
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, total, currency, created_at, created_by, order_items (qty, products (name, unit))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const order = data as unknown as OrderRow;
  if (order.created_by !== profile.id) redirect("/foreman/orders");

  const canConfirm = order.status === "ordered" || order.status === "approved";
  const alreadyDelivered = order.status === "delivered";

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
        <ul className="divide-y divide-zinc-100">
          {order.order_items.map((line, idx) => (
            <li key={idx} className="flex items-center justify-between py-2 text-sm">
              <span className="text-zinc-900">{line.products.name}</span>
              <span className="text-zinc-600">
                {Number(line.qty)} {line.products.unit}
              </span>
            </li>
          ))}
        </ul>
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
