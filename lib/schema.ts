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
  unit: z.string().min(1),
  unit_price: z.number().positive().nullable(),
  product_group: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ingestResponseSchema = z.object({
  supplier_name: z.string().min(1),
  rows: z.array(ingestedProductSchema),
});

export type IngestedProduct = z.infer<typeof ingestedProductSchema>;
export type IngestResponse = z.infer<typeof ingestResponseSchema>;

// ---------------------------------------------------------------------------
// AI discovery (Phase 7) — POST /api/discover
// ---------------------------------------------------------------------------

export const discoverItemSchema = z.object({
  product_id: z.string().uuid(),
  reason: z.string().min(1),
});

export const discoverResponseSchema = z.object({
  items: z.array(discoverItemSchema).max(5),
});

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
