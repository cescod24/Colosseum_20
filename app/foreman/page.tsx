import { redirect } from "next/navigation";

import { getDemoRole } from "@/lib/role";
import {
  loadForemanOrders,
  loadLastOrderForForeman,
  loadMaterialSets,
  loadMostOrderedForProject,
  loadProfileForRole,
  loadProjectCatalog,
  type CatalogProduct,
} from "@/lib/data/foreman";

import { ForemanHomeClient } from "./_components/ForemanHomeClient";

export const dynamic = "force-dynamic";

export default async function ForemanHome() {
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
          Wahrscheinlich fehlt noch ein <code>npm run seed</code>. Sobald die
          Cloud-Datenbank initialisiert ist, erscheint diese Seite mit deinem
          letzten Auftrag.
        </p>
      </main>
    );
  }

  const catalog = await loadProjectCatalog(profile.project_id);
  const catalogById = new Map<string, CatalogProduct>(
    catalog.map((p) => [p.id, p]),
  );
  const [lastOrder, sets, mostOrdered] = await Promise.all([
    loadLastOrderForForeman(profile.id, catalogById),
    loadMaterialSets(profile.project_id, catalogById),
    loadMostOrderedForProject(profile.project_id, catalogById, 5),
  ]);
  // touch the helper so a future Phase 3 commit can re-use it without a
  // dangling import dance.
  void loadForemanOrders;

  return (
    <ForemanHomeClient
      greeting={profile.display_name}
      catalog={catalog}
      lastOrder={lastOrder}
      sets={sets}
      mostOrdered={mostOrdered}
    />
  );
}
