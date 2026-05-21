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

import type { AiVoiceResponse } from "../schema";

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
