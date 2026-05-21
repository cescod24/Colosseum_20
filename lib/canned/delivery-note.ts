import "server-only";
import type { DeliveryNoteExtract } from "@/lib/schema";

// Canned response for the delivery-note OCR call when OpenAI is unavailable
// (missing key / timeout / parse failure). The shape is deliberately
// generic — the route handler accepts any non-empty extract above
// the confidence floor and flips the order to 'delivered'.

export const CANNED_DELIVERY_NOTE: DeliveryNoteExtract = {
  order_ref: "LS-2026-05-22-A4F1",
  supplier_name: "Würth",
  delivery_date: "2026-05-22",
  line_count: 4,
  confidence: 0.92,
};
