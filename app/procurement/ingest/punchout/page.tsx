import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { importHaefelePunchout } from "@/lib/server/punchout";
import { copyEn } from "@/lib/constants/copy.en";

export const dynamic = "force-dynamic";

async function connectHaefele() {
  "use server";
  const role = await getDemoRole();
  if (role !== "procurement") return;
  const profile = await resolveProfileForRole(role);
  if (!profile?.project_id) return;
  try {
    await importHaefelePunchout(profile.project_id);
    revalidatePath("/procurement/catalog");
    revalidatePath("/procurement/ingest/punchout");
  } catch (err) {
    console.warn("[punchout] failed", err);
  }
  redirect(`/procurement/ingest/punchout?imported=1`);
}

export default async function PunchoutPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const params = await searchParams;
  const justImported = params.imported === "1";

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["punchout.title"]}
        </h1>
        <p className="text-sm text-zinc-500">{copyEn["punchout.subtitle"]}</p>
      </header>

      {justImported && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {copyEn["punchout.success"]}
        </div>
      )}

      <article className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-900">Häfele DE</p>
          <p className="text-sm text-zinc-600">
            {copyEn["punchout.haefele_description"]}
          </p>
        </div>
        <form action={connectHaefele}>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            {copyEn["punchout.connect"]}
          </button>
        </form>
        <p className="text-xs text-zinc-500">
          {copyEn["punchout.note"]}{" "}
          <Link
            href="/procurement/catalog"
            className="underline hover:text-zinc-900"
          >
            {copyEn["punchout.view_catalog"]}
          </Link>
        </p>
      </article>

      <article className="space-y-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-xs text-zinc-600">
        <p className="font-semibold uppercase tracking-wider text-zinc-500">
          {copyEn["punchout.architecture_label"]}
        </p>
        <p>{copyEn["punchout.architecture_body"]}</p>
      </article>
    </section>
  );
}
