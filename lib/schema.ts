// Zod schemas for:
//   - AI ingestion output (PDF → product rows), see Phase 6
//   - AI discovery output (task → ranked items), see Phase 7
//   - client-submitted order payloads, see Phase 4
//
// Step 0 ships skeleton schemas with the right field shape so route handlers
// can already `import` them. Each phase fills in the exact constraints when
// the handler lands.

import { z } from "zod";

// ---------------------------------------------------------------------------
// AI ingestion (Phase 6) — POST /api/ingest
// ---------------------------------------------------------------------------

// Tolerant of AI output quirks: models often return `null` for booleans
// they're unsure about, prices as strings, or out-of-range confidences.
// We coerce rather than reject — the row still has to survive `isReviewRow`,
// so a coerced-to-null price just routes it to review anyway.
export const ingestedProductSchema = z.object({
  name: z.string().min(1),
  supplier_sku: z.string().min(1),
  unit: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  unit_price: z
    .union([z.number(), z.string(), z.null()])
    .nullish()
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  product_group: z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  hazardous: z
    .boolean()
    .nullish()
    .transform((v) => v ?? false),
  confidence: z
    .number()
    .nullish()
    .transform((v) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5,
    ),
});

export const ingestResponseSchema = z.object({
  supplier_name: z.string().min(1),
  rows: z.array(ingestedProductSchema),
});

export type IngestedProduct = z.infer<typeof ingestedProductSchema>;
export type IngestResponse = z.infer<typeof ingestResponseSchema>;

/**
 * A row is sent to procurement review (status='review') if it has any of:
 *   - unit_price is null
 *   - unit is null / empty
 *   - confidence < 0.7
 *
 * Otherwise it lands as status='active'.
 */
export function isReviewRow(row: IngestedProduct): boolean {
  if (row.unit_price === null) return true;
  if (!row.unit || row.unit.trim() === "") return true;
  if (row.confidence < 0.7) return true;
  return false;
}

// ---------------------------------------------------------------------------
// AI discovery (Phase 7) — POST /api/discover
// ---------------------------------------------------------------------------
//
// The AI is asked for `{ supplier_sku, reason }` per item; the route handler
// resolves `supplier_sku → { product_id, name, unit, product_group }` server
// side from the catalog before returning, so client components get
// everything they need to render the result without a second DB hop.
//
// Two schemas: `aiDiscoverItemSchema` is what the model returns;
// `discoverItemSchema` is what the client receives.

export const aiDiscoverItemSchema = z.object({
  supplier_sku: z.string().min(1),
  reason: z.string().min(1),
});

export const aiDiscoverResponseSchema = z.object({
  items: z.array(aiDiscoverItemSchema).max(5),
});

export const discoverItemSchema = z.object({
  product_id: z.string().uuid(),
  supplier_sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  product_group: z.string().nullable(),
  reason: z.string().min(1),
});

export const discoverResponseSchema = z.object({
  items: z.array(discoverItemSchema).max(5),
  /** True when the route fell back to canned data (no key / no DB / timeout). */
  canned: z.boolean(),
});

export type AiDiscoverItem = z.infer<typeof aiDiscoverItemSchema>;
export type AiDiscoverResponse = z.infer<typeof aiDiscoverResponseSchema>;
export type DiscoverItem = z.infer<typeof discoverItemSchema>;
export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;

// ---------------------------------------------------------------------------
// Client → server order submission (Phase 4) — POST /api/orders
// ---------------------------------------------------------------------------
// The server is the source of truth for `unit_price` and `total`; the client
// only sends product_id + qty. Anything else is recomputed server-side.

export const orderLineInputSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().positive(),
});

export const submitOrderInputSchema = z.object({
  items: z.array(orderLineInputSchema).min(1),
});

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderInputSchema>;

// ---------------------------------------------------------------------------
// Procurement-side product edits (Phase 9.3.3) — PATCH /api/products/[id]
// ---------------------------------------------------------------------------

export const productPatchInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    product_group: z.string().min(1).nullable().optional(),
    unit_price: z.number().positive().nullable().optional(),
    status: z.enum(["active", "review"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided.",
  });

export type ProductPatchInput = z.infer<typeof productPatchInputSchema>;

// ---------------------------------------------------------------------------
// Delivery-note OCR (Phase 10 B1) — POST /api/orders/[id]/confirm-delivery
// ---------------------------------------------------------------------------
// Vision call extracts a minimal delivery-note signature so the foreman
// can one-tap-confirm delivery without waiting for the 8 s timer.

export const deliveryNoteExtractSchema = z.object({
  order_ref: z.string().nullable(),
  supplier_name: z.string().nullable(),
  delivery_date: z.string().nullable(),
  line_count: z.number().int().min(0).nullable(),
  confidence: z.number().min(0).max(1),
});

export type DeliveryNoteExtract = z.infer<typeof deliveryNoteExtractSchema>;

// ---------------------------------------------------------------------------
// Voice ordering (slice A) — POST /api/voice
// ---------------------------------------------------------------------------
// Browser captures audio with MediaRecorder, posts it as multipart/form-data.
// Server transcribes (Whisper), runs the A-material blocklist on the
// transcript, then asks the LLM for {supplier_sku, qty} pairs against the
// project catalog. Route resolves SKU → product_id before responding so the
// client just calls addToCart(product_id, qty) for each entry.

export const aiVoiceItemSchema = z.object({
  supplier_sku: z.string().min(1),
  qty: z.number().int().positive().max(999),
});

export const aiVoiceResponseSchema = z.object({
  items: z.array(aiVoiceItemSchema).max(8),
});

export const voiceItemSchema = z.object({
  product_id: z.string().uuid(),
  supplier_sku: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  qty: z.number().int().positive(),
});

export const voiceUnmatchedSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().positive(),
});

export const voiceResponseSchema = z.object({
  transcript: z.string(),
  items: z.array(voiceItemSchema).max(8),
  unmatched: z.array(voiceUnmatchedSchema).max(8),
  /** True when the route fell back to canned data (no key / no DB / timeout). */
  canned: z.boolean().optional(),
  /** Set when the transcript hit the A-material blocklist; client renders the friendly redirect. */
  redirect: z.boolean().optional(),
  message: z.string().optional(),
});

export type AiVoiceItem = z.infer<typeof aiVoiceItemSchema>;
export type AiVoiceResponse = z.infer<typeof aiVoiceResponseSchema>;
export type VoiceItem = z.infer<typeof voiceItemSchema>;
export type VoiceUnmatched = z.infer<typeof voiceUnmatchedSchema>;
export type VoiceResponse = z.infer<typeof voiceResponseSchema>;

// ---------------------------------------------------------------------------
// Partial order decisions (migration 0004) — POST /api/orders/[id]/decide
// ---------------------------------------------------------------------------
// Procurement can decide each line independently. Either:
//   { action: "approve" | "reject" }     — legacy whole-order decision
//   { lines: [ { order_item_id, decision, reason?, suggested_product_id?, suggested_qty? } ] }
// The line form: every order_item_id of the pending order must appear once.
// Declined lines may carry a free-text reason and an optional suggested
// alternative product + qty.

export const decideOrderLineSchema = z
  .object({
    order_item_id: z.string().uuid(),
    decision: z.enum(["approve", "decline"]),
    reason: z
      .string()
      .max(500)
      .nullish()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
    suggested_product_id: z.string().uuid().nullish(),
    suggested_qty: z
      .union([z.number(), z.string()])
      .nullish()
      .transform((v) => {
        if (v === null || v === undefined || v === "") return null;
        const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
        return Number.isFinite(n) && n > 0 ? n : null;
      }),
  })
  .refine(
    (v) => v.decision === "approve" || !v.suggested_product_id || v.suggested_qty !== null,
    {
      message: "A suggested product needs a positive quantity.",
      path: ["suggested_qty"],
    },
  );

export const decideOrderLinesInputSchema = z.object({
  lines: z.array(decideOrderLineSchema).min(1),
});

export type DecideOrderLineInput = z.infer<typeof decideOrderLineSchema>;
export type DecideOrderLinesInput = z.infer<typeof decideOrderLinesInputSchema>;
