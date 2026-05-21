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

export const ingestedProductSchema = z.object({
  name: z.string().min(1),
  supplier_sku: z.string().min(1),
  unit: z.string().nullable(),
  unit_price: z.number().positive().nullable(),
  product_group: z.string().nullable(),
  hazardous: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
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
