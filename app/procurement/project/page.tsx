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
        <h1 className="text-2xl font-semibold text-zinc-900">
          {copyEn["project.title"]}
        </h1>
        <p className="text-sm text-zinc-500">{project.name}</p>
      </header>

      <form
        action={saveProjectRules}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="projectId" value={project.id} />

        <div className="space-y-2">
          <label
            htmlFor="threshold"
            className="block text-sm font-medium text-zinc-900"
          >
            {copyEn["project.threshold_label"]}
          </label>
          <input
            id="threshold"
            name="threshold"
            type="number"
            min={0}
            step={1}
            defaultValue={Number(project.auto_approve_threshold)}
            className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-base shadow-sm focus:border-zinc-900 focus:outline-none"
          />
          <p className="text-xs text-zinc-500">
            {copyEn["project.threshold_help"]}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="restricted_groups"
            className="block text-sm font-medium text-zinc-900"
          >
            {copyEn["project.restricted_groups_label"]}
          </label>
          <input
            id="restricted_groups"
            name="restricted_groups"
            type="text"
            defaultValue={restrictedGroups}
            placeholder="Hazardous, Explosives"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base shadow-sm focus:border-zinc-900 focus:outline-none"
          />
          <p className="text-xs text-zinc-500">
            {copyEn["project.restricted_groups_help"]}
          </p>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {copyEn["project.save"]}
        </button>
      </form>
    </section>
  );
}
