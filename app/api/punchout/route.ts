import { NextResponse } from "next/server";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { importHaefelePunchout } from "@/lib/server/punchout";

export const runtime = "nodejs";

export async function POST() {
  const role = await getDemoRole();
  if (role !== "procurement") {
    return NextResponse.json(
      { error: "Procurement role required." },
      { status: 401 },
    );
  }

  const profile = await resolveProfileForRole(role);
  if (!profile || profile.role !== "procurement") {
    return NextResponse.json(
      { error: "Procurement profile not seeded." },
      { status: 400 },
    );
  }

  try {
    const result = await importHaefelePunchout(profile.project_id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
