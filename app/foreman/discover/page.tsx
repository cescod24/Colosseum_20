import { redirect } from "next/navigation";

import { getDemoRole } from "@/lib/role";
import { copyDe } from "@/lib/constants/copy.de";
import { loadProfileForRole, loadProjectCatalog } from "@/lib/data/foreman";

import { DiscoverClient } from "../_components/DiscoverClient";

export const dynamic = "force-dynamic";

export default async function ForemanDiscover() {
  const role = await getDemoRole();
  if (!role || role === "procurement") redirect("/");

  const profile = await loadProfileForRole(role);
  if (!profile) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-lg font-semibold text-zinc-900">
          {copyDe["discover.no_project"]}
        </h1>
      </main>
    );
  }

  const catalog = await loadProjectCatalog(profile.project_id);

  return (
    <DiscoverClient
      projectId={profile.project_id}
      catalog={catalog.map((p) => ({
        product_id: p.id,
        supplier_sku: p.supplier_sku,
        name: p.name,
        unit: p.unit,
        product_group: p.product_group,
        unit_price: p.unit_price,
      }))}
    />
  );
}
