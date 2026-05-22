import { revalidatePath } from "next/cache";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { copyEn } from "@/lib/constants/copy.en";

type ProjectRow = {
  id: string;
  name: string;
  auto_approve_threshold: number;
  currency: string;
};

async function saveProjectRules(formData: FormData) {
  "use server";
  const projectId = String(formData.get("projectId") ?? "");
  const thresholdRaw = String(formData.get("threshold") ?? "");
  const groupsRaw = String(formData.get("restricted_groups") ?? "");

  if (!projectId) return;
  const threshold = Number(thresholdRaw);
  if (!Number.isFinite(threshold) || threshold < 0) return;

  const role = await getDemoRole();
  if (role !== "procurement") return;

  const supabase = getServerClient();

  await supabase
    .from("projects")
    .update({ auto_approve_threshold: threshold })
    .eq("id", projectId);

  const groups = groupsRaw
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);

  const { data: existingRule } = await supabase
    .from("approval_rules")
    .select("id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingRule) {
    await supabase
      .from("approval_rules")
      .update({ restricted_groups: groups, threshold })
      .eq("id", existingRule.id);
  } else {
    await supabase
      .from("approval_rules")
      .insert({ project_id: projectId, threshold, restricted_groups: groups });
  }

  revalidatePath("/procurement/project");
}

export default async function ProjectRulesPage() {
  const role = await getDemoRole();
  const profile = role ? await resolveProfileForRole(role) : null;

  if (!profile?.project_id) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["project.title"]}
        </h1>
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {copyEn["project.missing"]}
        </p>
      </section>
    );
  }

  const supabase = getServerClient();

  const { data: projectRaw } = await supabase
    .from("projects")
    .select("id, name, auto_approve_threshold, currency")
    .eq("id", profile.project_id)
    .maybeSingle();

  const project = projectRaw as ProjectRow | null;

  const { data: rulesRow } = await supabase
    .from("approval_rules")
    .select("restricted_groups")
    .eq("project_id", profile.project_id)
    .maybeSingle();

  if (!project) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["project.title"]}
        </h1>
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500">
          {copyEn["project.missing"]}
        </p>
      </section>
    );
  }

  const restrictedGroups = ((rulesRow?.restricted_groups ?? []) as string[]).join(
    ", ",
  );

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700/80">
          Procurement
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          {copyEn["project.title"]}
        </h1>
        <p className="text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">{project.name}</span> ·
          approval rules that drive every foreman order
        </p>
      </header>

      <form
        action={saveProjectRules}
        className="space-y-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <input type="hidden" name="projectId" value={project.id} />

        <div className="space-y-2 border-l-2 border-amber-400 pl-4">
          <label
            htmlFor="threshold"
            className="block text-sm font-semibold text-zinc-900"
          >
            {copyEn["project.threshold_label"]}
          </label>
          <p className="text-xs text-zinc-500">
            {copyEn["project.threshold_help"]}
          </p>
          <div className="flex items-center gap-2">
            <input
              id="threshold"
              name="threshold"
              type="number"
              min={0}
              step={1}
              defaultValue={Number(project.auto_approve_threshold)}
              className="w-full max-w-[8rem] rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold text-zinc-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <span className="text-sm font-medium text-zinc-500">CHF</span>
          </div>
        </div>

        <div className="space-y-2 border-l-2 border-rose-400 pl-4">
          <label
            htmlFor="restricted_groups"
            className="block text-sm font-semibold text-zinc-900"
          >
            {copyEn["project.restricted_groups_label"]}
          </label>
          <p className="text-xs text-zinc-500">
            {copyEn["project.restricted_groups_help"]}
          </p>
          <input
            id="restricted_groups"
            name="restricted_groups"
            type="text"
            defaultValue={restrictedGroups}
            placeholder="hazardous, paint, explosives"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
          <p className="text-xs text-zinc-500">
            Changes apply to the next foreman submission.
          </p>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700"
          >
            {copyEn["project.save"]}
          </button>
        </div>
      </form>
    </section>
  );
}
