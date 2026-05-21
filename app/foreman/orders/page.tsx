import { redirect } from "next/navigation";

import { getDemoRole } from "@/lib/role";
import { loadForemanOrders, loadProfileForRole } from "@/lib/data/foreman";

import { OrdersListClient } from "../_components/OrdersListClient";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  status: "draft" | "pending" | "approved" | "ordered" | "delivered";
  total: number | string;
  currency: string;
  created_at: string;
  items: Array<{ qty: number | string; product_id: string }>;
};

export default async function ForemanOrders() {
  const role = await getDemoRole();
  if (!role || role === "procurement") redirect("/");

  const profile = await loadProfileForRole(role);
  if (!profile) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-zinc-900">
          Profil nicht gefunden
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Wahrscheinlich fehlt noch ein <code>npm run seed</code>.
        </p>
      </main>
    );
  }

  const raw = (await loadForemanOrders(profile.id)) as unknown as OrderRow[];
  const initialOrders = raw.map((o) => ({
    id: o.id,
    status: o.status,
    total: Number(o.total),
    currency: o.currency,
    created_at: o.created_at,
    items: (o.items ?? []).map((it) => ({
      qty: Number(it.qty),
      product_id: it.product_id,
    })),
  }));

  return (
    <OrdersListClient initialOrders={initialOrders} profileId={profile.id} />
  );
}
