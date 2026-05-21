import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { approveOrder, rejectOrder } from "@/lib/server/orders";

export const runtime = "nodejs";

const decideInputSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = decideInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const result =
    parsed.data.action === "approve"
      ? await approveOrder(id, profile.id)
      : await rejectOrder(id, profile.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }
  return NextResponse.json({ id, status: result.status });
}
