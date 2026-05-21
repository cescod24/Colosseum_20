// Single chokepoint for Anthropic API calls. NEVER import this module from
// client components — it reads `ANTHROPIC_API_KEY` and is intended for
// route handlers under `app/api/**` only.
//
// Behaviour:
//   * 12 s timeout on every call
//   * on missing key / timeout / any error: log and return a canned fallback
//   * callers ALWAYS get a parsed object of the shape they ask for — never
//     a raw SDK response — so canned fallbacks and real responses are
//     interchangeable for the caller
//
// Step 0 ships the wrapper signature and the timeout/fallback plumbing. The
// real prompts live in the Phase 6 (ingest) and Phase 7 (discover) route
// handlers; they pass the prompt + a `fallback` value here.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-sonnet-4-5";
export const ANTHROPIC_TIMEOUT_MS = 12_000;

type CallOptions<T> = {
  system: string;
  user: string | Array<Anthropic.Messages.ContentBlockParam>;
  /** Returned verbatim if no key / timeout / error / parse-fail. */
  fallback: T;
  /** Validate + parse the model's text output into T. Throw to trigger fallback. */
  parse: (text: string) => T;
  maxTokens?: number;
};

export async function callAnthropic<T>(opts: CallOptions<T>): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.warn("[anthropic] ANTHROPIC_API_KEY missing — returning canned fallback");
    return opts.fallback;
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const response = await Promise.race<Anthropic.Messages.Message | "__timeout__">([
      client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: [
          {
            role: "user",
            content: opts.user,
          },
        ],
      }),
      new Promise<"__timeout__">((resolve) =>
        setTimeout(() => resolve("__timeout__"), ANTHROPIC_TIMEOUT_MS),
      ),
    ]);

    if (response === "__timeout__") {
      console.warn("[anthropic] timed out after %d ms — returning canned fallback", ANTHROPIC_TIMEOUT_MS);
      return opts.fallback;
    }

    const text = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return opts.parse(text);
  } catch (err) {
    console.warn("[anthropic] call failed — returning canned fallback", err);
    return opts.fallback;
  }
}
