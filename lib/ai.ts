// Single chokepoint for AI calls (OpenAI). NEVER import this module from
// client components — it reads `OPENAI_API_KEY` and is intended for route
// handlers under `app/api/**` only.
//
// Behaviour:
//   * 20 s timeout on every call (OpenAI SDK built-in)
//   * JSON mode (response_format json_object) for reliable parsing
//   * on missing key / timeout / any error / empty output: log and return a
//     canned fallback — callers ALWAYS get a parsed object of the shape they
//     asked for, so canned and real responses are interchangeable
//
// PDFs are passed as a base64 `file` content part (chat completions file
// input). Text-only callers just pass `userText`.

import "server-only";
import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const AI_TIMEOUT_MS = 20_000;

type CallOptions<T> = {
  system: string;
  userText: string;
  /** Optional PDF (base64, no data: prefix) attached as a file content part. */
  pdfBase64?: string;
  pdfFilename?: string;
  /** Optional image (base64, no data: prefix) for vision calls (delivery-note OCR). */
  imageBase64?: string;
  /** MIME type for the image; defaults to image/jpeg. */
  imageMimeType?: string;
  /** Returned verbatim if no key / timeout / error / parse-fail. */
  fallback: T;
  /** Validate + parse the model's text output into T. Throw to trigger fallback. */
  parse: (text: string) => T;
};

export async function callAI<T>(opts: CallOptions<T>): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("[ai] OPENAI_API_KEY missing — returning canned fallback");
    return opts.fallback;
  }

  const client = new OpenAI({ apiKey: key, timeout: AI_TIMEOUT_MS });

  const userParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: opts.userText },
  ];
  if (opts.pdfBase64) {
    userParts.push({
      type: "file",
      file: {
        filename: opts.pdfFilename ?? "document.pdf",
        file_data: `data:application/pdf;base64,${opts.pdfBase64}`,
      },
    });
  }
  if (opts.imageBase64) {
    const mime = opts.imageMimeType ?? "image/jpeg";
    userParts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${opts.imageBase64}` },
    });
  }

  try {
    const resp = await client.chat.completions.create({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: userParts },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      console.warn("[ai] empty completion — returning canned fallback");
      return opts.fallback;
    }
    return opts.parse(text);
  } catch (err) {
    console.warn("[ai] call failed — returning canned fallback", err);
    return opts.fallback;
  }
}
