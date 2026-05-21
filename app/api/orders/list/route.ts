// GET /api/orders/list
//
// Lightweight polling fallback for the foreman orders page. Realtime is the
// primary update channel; this 5 s poll merges client-side so the status
// flip never fails on stage even if the websocket drops.

import { NextResponse } from "next/server";

import { getDemoRole } from "@/lib/role";
import { loadForemanOrders, loadProfileForRole } from "@/lib/data/foreman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const role = await getDemoRole();
  if (!role || role === "procurement") {
    return NextResponse.json({ error: "no foreman role" }, { status: 401 });
  }
  const profile = await loadProfileForRole(role);
  if (!profile) {
    return NextResponse.json({ orders: [] });
  }
  const orders = await loadForemanOrders(profile.id);
  return NextResponse.json({ orders });
}
