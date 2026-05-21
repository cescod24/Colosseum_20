import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { DemoRole } from "@/lib/role";

// Cookie value ('foreman-a' / 'foreman-b' / 'procurement') maps to a row in
// `profiles` whose `display_name` equals the cookie value verbatim. The seed
// (Dev C lane) must populate three rows that match this convention.

export type DemoProfile = {
  id: string;
  role: "foreman" | "procurement";
  project_id: string | null;
};

export async function resolveProfileForRole(
  role: DemoRole,
): Promise<DemoProfile | null> {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, project_id")
    .eq("display_name", role)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as DemoProfile;
}
