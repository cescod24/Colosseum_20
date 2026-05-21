import { NextResponse } from "next/server";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { productPatchInputSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function PATCH(
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
  const parsed = productPatchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid patch.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getServerClient();
  const { data, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", id)
    .select("id, name, product_group, unit_price")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  return NextResponse.json(data);
}
