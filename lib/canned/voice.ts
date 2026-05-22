// Canned voice-ordering fallback for the rehearsed demo.
//
// Returned by `/api/voice` when:
//   - OPENAI_API_KEY is missing or Whisper / the chat completion errored / timed out;
//   - AND (after transcription) the transcript matches one of the entries below.
//
// `CANNED_VOICE_TRANSCRIPT` is what `transcribeAudio()` returns when the key is
// missing — it's chosen to hit the "fasteners + tape + drill bit" canned entry so
// the demo still ends up with a non-empty cart. The route resolves the SKUs to
// UUIDs from the seeded catalog (when the DB is available) or from
// `fallbackCatalog()` in /api/discover when there's no DB.

import type { AiAssistantReply, AiVoiceResponse } from "../schema";

/** Default transcript handed back when transcribeAudio falls back. */
export const CANNED_VOICE_TRANSCRIPT =
  "Ich brauche zehn Schrauben TX25 sechs mal achtzig und zwei Rollen Panzertape und einen Bohrer acht Millimeter.";

type CannedHit = {
  matches: readonly string[];
  response: AiVoiceResponse;
};

const HITS: ReadonlyArray<CannedHit> = [
  {
    matches: ["schrauben tx25", "tx25", "schrauben"],
    response: {
      items: [
        { supplier_sku: "C003", qty: 10 }, // Schraube TX25 6x80
        { supplier_sku: "C027", qty: 2 }, // Panzertape silber
        { supplier_sku: "C034", qty: 1 }, // Bohrer 8mm
      ],
    },
  },
  {
    matches: ["handschuhe", "gehörschutz", "ppe-set", "psa"],
    response: {
      items: [
        { supplier_sku: "C019", qty: 4 }, // Arbeitshandschuhe Gr.9
        { supplier_sku: "C022", qty: 4 }, // Gehörschutzstöpsel
        { supplier_sku: "C021", qty: 2 }, // Schutzbrille klar
        { supplier_sku: "C024", qty: 2 }, // Warnweste orange
      ],
    },
  },
  {
    matches: ["silikon", "abdichten", "fenster", "reinigungsalkohol"],
    response: {
      items: [
        { supplier_sku: "C039", qty: 3 }, // Silikon transparent
        { supplier_sku: "C043", qty: 1 }, // Reinigungsalkohol
        { supplier_sku: "C027", qty: 1 }, // Panzertape silber
      ],
    },
  },
  {
    matches: ["werkzeug", "bohrer", "bit", "wasserwaage"],
    response: {
      items: [
        { supplier_sku: "C034", qty: 2 }, // Bohrer 8mm
        { supplier_sku: "C032", qty: 4 }, // Bit TX20
        { supplier_sku: "C033", qty: 4 }, // Bit TX25
        { supplier_sku: "C046", qty: 1 }, // Wasserwaage 60cm
      ],
    },
  },
];

const DEFAULT_RESPONSE: AiVoiceResponse = HITS[0].response;

export function cannedVoiceFor(transcript: string): AiVoiceResponse {
  const t = transcript.toLowerCase();
  for (const hit of HITS) {
    if (hit.matches.some((needle) => t.includes(needle))) return hit.response;
  }
  return DEFAULT_RESPONSE;
}

// ---------------------------------------------------------------------------
// Canned assistant replies (richer shape — see lib/schema.ts:aiAssistantReply)
// ---------------------------------------------------------------------------
// Used when OPENAI_API_KEY is missing or the live chat completion errored.
// Each entry returns a conversational German reply alongside the items.

type CannedAssistantHit = {
  matches: readonly string[];
  response: AiAssistantReply;
};

const ASSISTANT_HITS: ReadonlyArray<CannedAssistantHit> = [
  {
    matches: ["schrauben tx25", "tx25", "schrauben"],
    response: {
      reply: "10× Schraube TX25 6×80, 2× Panzertape, 1× Bohrer 8 mm.",
      items: [
        { supplier_sku: "C003", qty: 10 },
        { supplier_sku: "C027", qty: 2 },
        { supplier_sku: "C034", qty: 1 },
      ],
      cart_removals: [],
    },
  },
  {
    matches: ["handschuhe", "gehörschutz", "ppe-set", "psa", "neuer mitarbeiter"],
    response: {
      reply:
        "PSA-Set neuer Mitarbeiter: Handschuhe, Gehörschutz, Brille, Warnweste.",
      items: [
        { supplier_sku: "C019", qty: 4 },
        { supplier_sku: "C022", qty: 4 },
        { supplier_sku: "C021", qty: 2 },
        { supplier_sku: "C024", qty: 2 },
      ],
      cart_removals: [],
    },
  },
  {
    matches: ["silikon", "abdichten", "fenster", "reinigungsalkohol"],
    response: {
      reply: "Fenster abdichten: Silikon, Reinigungsalkohol, Panzertape.",
      items: [
        { supplier_sku: "C039", qty: 3 },
        { supplier_sku: "C043", qty: 1 },
        { supplier_sku: "C027", qty: 1 },
      ],
      cart_removals: [],
    },
  },
  {
    matches: ["werkzeug", "bohrer", "bit", "wasserwaage"],
    response: {
      reply:
        "Werkzeug-Grundausstattung: Bohrer 8 mm, TX20+TX25 Bits, Wasserwaage.",
      items: [
        { supplier_sku: "C034", qty: 2 },
        { supplier_sku: "C032", qty: 4 },
        { supplier_sku: "C033", qty: 4 },
        { supplier_sku: "C046", qty: 1 },
      ],
      cart_removals: [],
    },
  },
  {
    matches: ["wie viel", "wieviel", "budget", "kosten", "preis", "rahmenvertrag"],
    response: {
      // Even questions get a concrete recommendation: the foreman is in a
      // hurry; budget questions get answered alongside a likely small order.
      reply:
        "Bis 200 CHF auto-genehmigt. Hier ein kleines Standard-Set.",
      items: [
        { supplier_sku: "C027", qty: 2 },
        { supplier_sku: "C047", qty: 1 },
      ],
      cart_removals: [],
    },
  },
];

const DEFAULT_ASSISTANT: AiAssistantReply = ASSISTANT_HITS[0].response;

export function cannedAssistantFor(transcript: string): AiAssistantReply {
  const t = transcript.toLowerCase();
  for (const hit of ASSISTANT_HITS) {
    if (hit.matches.some((needle) => t.includes(needle))) return hit.response;
  }
  return DEFAULT_ASSISTANT;
}
