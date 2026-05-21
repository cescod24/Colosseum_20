import { NextResponse } from "next/server";
import { getDemoRole } from "@/lib/role";
import { resolveProfileForRole } from "@/lib/server/demo-profile";
import { getServerClient } from "@/lib/supabase/server";
import { callAI } from "@/lib/ai";
import {
  deliveryNoteExtractSchema,
  type DeliveryNoteExtract,
} from "@/lib/schema";
import { CANNED_DELIVERY_NOTE } from "@/lib/canned/delivery-note";

export const runtime = "nodejs";

const CONFIDENCE_FLOOR = 0.5;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const SYSTEM_PROMPT = `You receive a photograph of a paper construction-site delivery note ("Lieferschein"). Extract a minimal signature and return JSON of the shape:
{ "order_ref": string|null, "supplier_name": string|null, "delivery_date": string|null, "line_count": number|null, "confidence": number }

- order_ref: any visible order/delivery-note reference (e.g. "LS-2026-…", "Auftrag 4421"). Null if not visible.
- supplier_name: the supplier company at the top (e.g. "Würth", "Häfele", "ACME"). Null if not visible.
- delivery_date: ISO date if visible (YYYY-MM-DD). Null otherwise.
- line_count: number of line items on the note. Null if you cannot count.
- confidence: 0..1 — your overall confidence the photo is a real delivery note.

Return JSON only.`;

function parseExtract(text: string): DeliveryNoteExtract {
  const data = JSON.parse(text);
  return deliveryNoteExtractSchema.parse(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getDemoRole();
  if (role !== "foreman-a" && role !== "foreman-b") {
    return NextResponse.json({ error: "Foreman role required." }, { status: 401 });
  }
  const profile = await resolveProfileForRole(role);
  if (!profile || profile.role !== "foreman") {
    return NextResponse.json(
      { error: "Foreman profile not seeded." },
      { status: 400 },
    );
  }

  const { id: orderId } = await params;

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Photo required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo too large (max 5 MB)." },
      { status: 400 },
    );
  }

  const supabase = getServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, created_by")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.created_by !== profile.id) {
    return NextResponse.json({ error: "Not your order." }, { status: 403 });
  }
  if (order.status !== "ordered" && order.status !== "approved") {
    return NextResponse.json(
      { error: `Order is ${order.status}; cannot confirm delivery.` },
      { status: 409 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mime = file.type || "image/jpeg";

  const extract = await callAI<DeliveryNoteExtract>({
    system: SYSTEM_PROMPT,
    userText:
      "Extract the delivery-note signature from this photo. Return JSON only.",
    imageBase64: base64,
    imageMimeType: mime,
    fallback: CANNED_DELIVERY_NOTE,
    parse: parseExtract,
  });

  if (extract.confidence < CONFIDENCE_FLOOR) {
    return NextResponse.json(
      { extract, delivered: false, reason: "Low confidence — try a clearer photo." },
      { status: 200 },
    );
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId)
    .in("status", ["ordered", "approved"]);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ extract, delivered: true });
}
