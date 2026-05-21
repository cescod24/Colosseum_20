import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { DemoRole } from "@/lib/role";

// Cookie value ('foreman-a' / 'foreman-b' / 'procurement') maps to a row in
// `profiles`. The seed (Dev C lane) names rows with site-realistic labels
// like "Polier A (Hochbau / PPE)" / "Polier B (Werkzeug / Befestigung)" /
// "Bauleitung Zürich-West" rather than the literal cookie value, so we
// substring-match (case-insensitive) on a stable needle per role.

const ROLE_NEEDLE: Record<DemoRole, string> = {
  "foreman-a": "Polier A",
  "foreman-b": "Polier B",
  procurement: "Bauleitung",
};

export type DemoProfile = {
  id: string;
  role: "foreman" | "procurement";
  project_id: string | null;
};

export async function resolveProfileForRole(
  role: DemoRole,
): Promise<DemoProfile | null> {
  const supabase = getServerClient();
  const needle = ROLE_NEEDLE[role];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, project_id")
    .ilike("display_name", `%${needle}%`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DemoProfile;
}
