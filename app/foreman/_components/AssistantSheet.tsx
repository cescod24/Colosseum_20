"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Loader2,
  Mic,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import { copyDe, formatCopy } from "@/lib/constants/copy.de";
import {
  assistantResponseSchema,
  type AssistantItem,
  type AssistantResponse,
} from "@/lib/schema";

import { Stepper } from "./Stepper";

// Action-oriented assistant sheet.
//
// Foremen don't chat. The user speaks/types once, the assistant returns a
// concrete item recommendation, the user reviews (checkbox + Stepper), and
// one tap submits the order via POST /api/orders. No chat history, no
// follow-up questions, no alternatives. After submit, the sheet closes and
// the foreman lands on /foreman/orders to watch the live status pill.

type CartLineLite = { product_id: string; qty: number };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  /** Foreman's current cart — passed to the AI as context so it doesn't
   *  re-recommend items already pending. The AI's items submit as a NEW
   *  order; they do not merge into this cart. */
  cart: CartLineLite[];
};

type SelectedMap = Record<string, { selected: boolean; qty: number }>;

type Status =
  | { kind: "idle" }
  | { kind: "denied" }
  | { kind: "recording"; startedAt: number }
  | { kind: "processing" }
  | {
      kind: "result";
      transcript: string;
      reply: string;
      items: AssistantItem[];
      unmatched: AssistantResponse["unmatched"];
      canned?: boolean;
    }
  | { kind: "blocked"; transcript: string; message: string }
  | { kind: "submitting" }
  | { kind: "submitted"; orderTotal: number }
  | { kind: "error"; message: string };

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

function extForMime(m: string | undefined): string {
  if (!m) return "webm";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4")) return "mp4";
  return "webm";
}

export function AssistantSheet({ open, onClose, projectId, cart }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<SelectedMap>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  // See plan.md §13.4b — never read React state inside rec.onstop; the React
  // closure is stale by the time the callback fires. Use this ref instead.
  const recordingStartedAtRef = useRef<number | null>(null);

  // Reset when closing.
  useEffect(() => {
    if (!open) {
      stopStream();
      // setState-in-effect is intentional — we're resetting the sheet's
      // transient state when the sheet closes. Same pattern Dev B uses for
      // the per-line decisions panel.
      /* eslint-disable react-hooks/set-state-in-effect */
      setStatus({ kind: "idle" });
      setText("");
      setSelected({});
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    return () => stopStream();
  }, [open]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  const handleResponse = useCallback((body: AssistantResponse) => {
    if (body.redirect) {
      setStatus({
        kind: "blocked",
        transcript: body.transcript,
        message: body.message ?? body.reply ?? copyDe["voice.blocked"],
      });
      return;
    }
    if (body.items.length === 0) {
      setStatus({
        kind: "error",
        message: body.reply || copyDe["assistant.no_match"],
      });
      return;
    }
    // Seed the selection map (everything checked at the AI-suggested qty).
    const sel: SelectedMap = {};
    for (const it of body.items) sel[it.product_id] = { selected: true, qty: it.qty };
    setSelected(sel);
    setStatus({
      kind: "result",
      transcript: body.transcript,
      reply: body.reply,
      items: body.items,
      unmatched: body.unmatched,
      canned: body.canned,
    });
  }, []);

  const sendRequest = useCallback(
    async (init: { audioBlob?: Blob; userText?: string }, mimeType?: string) => {
      setStatus({ kind: "processing" });
      try {
        let res: Response;
        if (init.audioBlob) {
          const form = new FormData();
          form.append(
            "audio",
            init.audioBlob,
            `voice.${extForMime(mimeType || init.audioBlob.type || "audio/webm")}`,
          );
          if (projectId) form.append("project_id", projectId);
          form.append("cart", JSON.stringify(cart));
          res = await fetch("/api/voice", { method: "POST", body: form });
        } else {
          res = await fetch("/api/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: init.userText,
              project_id: projectId,
              cart,
            }),
          });
        }
        const raw = await res.json();
        const parsed = assistantResponseSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn("[assistant] response failed schema", parsed.error);
          setStatus({ kind: "error", message: copyDe["assistant.error"] });
          return;
        }
        handleResponse(parsed.data);
      } catch (err) {
        console.warn("[assistant] request failed", err);
        setStatus({ kind: "error", message: copyDe["assistant.error"] });
      }
    },
    [cart, handleResponse, projectId],
  );

  const startRecording = useCallback(async () => {
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const startedAt = recordingStartedAtRef.current ?? Date.now();
        recordingStartedAtRef.current = null;
        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        stopStream();
        if (elapsed < 500 || blob.size < 4096) {
          setStatus({
            kind: "error",
            message: copyDe["voice.too_short"],
          });
          return;
        }
        void sendRequest({ audioBlob: blob }, rec.mimeType);
      };
      recordingStartedAtRef.current = Date.now();
      rec.start();
      setStatus({ kind: "recording", startedAt: Date.now() });
    } catch (err) {
      console.warn("[assistant] mic permission denied", err);
      recordingStartedAtRef.current = null;
      stopStream();
      setStatus({ kind: "denied" });
    }
  }, [sendRequest]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const sendText = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    setText("");
    void sendRequest({ userText: t });
  }, [sendRequest, text]);

  function onMicTap() {
    if (status.kind === "recording") {
      stopRecording();
      return;
    }
    if (status.kind === "processing" || status.kind === "submitting") return;
    void startRecording();
  }

  // Compute total of currently selected items.
  const selectedTotal =
    status.kind === "result"
      ? status.items.reduce((sum, it) => {
          const s = selected[it.product_id];
          if (!s?.selected) return sum;
          if (it.unit_price == null) return sum;
          return sum + it.unit_price * s.qty;
        }, 0)
      : 0;

  const selectedCount =
    status.kind === "result"
      ? status.items.filter((it) => {
          const s = selected[it.product_id];
          return s?.selected && s.qty > 0;
        }).length
      : 0;

  const submitOrder = useCallback(async () => {
    if (status.kind !== "result") return;
    const lines = status.items
      .filter((it) => {
        const s = selected[it.product_id];
        return s?.selected && s.qty > 0;
      })
      .map((it) => ({ product_id: it.product_id, qty: selected[it.product_id].qty }));
    if (lines.length === 0) return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: lines }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${txt}`);
      }
      // We trust the server's authoritative total; client-side selectedTotal is
      // close enough to display on the success screen.
      setStatus({ kind: "submitted", orderTotal: selectedTotal });
      // After a beat, close + take the foreman to the live orders page.
      setTimeout(() => {
        onClose();
        router.push("/foreman/orders");
      }, 1200);
    } catch (err) {
      console.warn("[assistant] order submit failed", err);
      setStatus({ kind: "error", message: copyDe["cart.error"] });
    }
  }, [onClose, router, selected, selectedTotal, status]);

  if (!open) return null;

  const recording = status.kind === "recording";
  const processing = status.kind === "processing";
  const submitting = status.kind === "submitting";
  const lockInput = recording || processing || submitting;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:mt-8 sm:h-[calc(100%-2rem)] sm:rounded-t-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={copyDe["assistant.title"]}
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {copyDe["assistant.title"]}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {copyDe["assistant.subtitle"]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copyDe["assistant.discard"]}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {status.kind === "idle" && (
            <p className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              {copyDe["assistant.empty_intro"]}
            </p>
          )}

          {status.kind === "denied" && (
            <p className="rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {copyDe["assistant.permission_denied"]}
            </p>
          )}

          {(status.kind === "recording" || status.kind === "processing") && (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status.kind === "recording"
                ? copyDe["voice.recording"]
                : copyDe["assistant.processing"]}
            </div>
          )}

          {status.kind === "error" && (
            <div className="rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-900">
              {status.message}
            </div>
          )}

          {status.kind === "blocked" && (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-[11px] uppercase tracking-wider">
                  {copyDe["voice.transcript_label"]}
                </p>
                <p className="italic">&ldquo;{status.transcript}&rdquo;</p>
                <p className="mt-1">{status.message}</p>
              </div>
            </div>
          )}

          {status.kind === "submitted" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-6 text-emerald-900">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-base font-semibold">{copyDe["cart.submitted"]}</p>
              <p className="text-sm">
                {formatCopy(copyDe["cart.submit_with_total"], {
                  total: status.orderTotal.toFixed(2),
                })}
              </p>
            </div>
          )}

          {status.kind === "result" && (
            <ResultPanel
              transcript={status.transcript}
              reply={status.reply}
              canned={status.canned}
              items={status.items}
              unmatched={status.unmatched}
              selected={selected}
              setSelected={setSelected}
            />
          )}
        </div>

        {/* Submit row when we have a result; otherwise input row */}
        {status.kind === "result" ? (
          <footer className="space-y-2 border-t border-zinc-100 bg-white px-4 py-3 pb-6">
            <button
              type="button"
              onClick={submitOrder}
              disabled={selectedCount === 0 || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              <span>
                {submitting
                  ? copyDe["cart.sending"]
                  : selectedCount === 0
                    ? copyDe["assistant.no_match"]
                    : formatCopy(copyDe["cart.submit_with_total"], {
                        total: selectedTotal.toFixed(2),
                      })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus({ kind: "idle" });
                setSelected({});
              }}
              className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-900"
            >
              {copyDe["assistant.discard"]}
            </button>
          </footer>
        ) : status.kind === "submitted" || status.kind === "blocked" ? (
          <footer className="border-t border-zinc-100 bg-white px-4 py-3 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
            >
              {copyDe["assistant.discard"]}
            </button>
          </footer>
        ) : (
          <footer className="border-t border-zinc-100 bg-white px-4 py-3 pb-6">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendText();
                  }
                }}
                placeholder={copyDe["assistant.placeholder"]}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                disabled={lockInput}
              />
              <button
                type="button"
                onClick={sendText}
                disabled={!text.trim() || lockInput}
                aria-label={copyDe["assistant.send"]}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-white shadow-sm disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onMicTap}
                aria-label={
                  recording
                    ? copyDe["assistant.stop_listening"]
                    : copyDe["assistant.start_listening"]
                }
                disabled={processing || submitting}
                className={
                  "flex h-10 w-12 items-center justify-center rounded-xl shadow-sm transition-colors " +
                  (recording
                    ? "bg-rose-600 text-white animate-pulse"
                    : processing || submitting
                      ? "bg-zinc-300 text-zinc-500"
                      : "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-white")
                }
              >
                {recording ? (
                  <Square className="h-4 w-4" fill="currentColor" />
                ) : processing || submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result panel — transcript + reply + checkable item list. No prices per line.
// ---------------------------------------------------------------------------

function ResultPanel({
  transcript,
  reply,
  canned,
  items,
  unmatched,
  selected,
  setSelected,
}: {
  transcript: string;
  reply: string;
  canned?: boolean;
  items: AssistantItem[];
  unmatched: AssistantResponse["unmatched"];
  selected: SelectedMap;
  setSelected: React.Dispatch<React.SetStateAction<SelectedMap>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 rounded-2xl bg-zinc-50 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          {copyDe["voice.transcript_label"]}
        </p>
        <p className="text-sm italic text-zinc-700">&ldquo;{transcript}&rdquo;</p>
      </div>

      <p className="text-sm text-zinc-900">{reply}</p>

      <ul className="space-y-1.5">
        {items.map((it) => {
          const s = selected[it.product_id] ?? { selected: true, qty: it.qty };
          return (
            <li
              key={it.product_id}
              className={
                "flex items-center gap-2 rounded-2xl border px-2 py-1.5 transition-colors " +
                (s.selected
                  ? "border-zinc-200 bg-white"
                  : "border-zinc-100 bg-zinc-50 opacity-60")
              }
            >
              <button
                type="button"
                onClick={() =>
                  setSelected((prev) => ({
                    ...prev,
                    [it.product_id]: {
                      selected: !(prev[it.product_id]?.selected ?? true),
                      qty: prev[it.product_id]?.qty ?? it.qty,
                    },
                  }))
                }
                aria-pressed={s.selected}
                className={
                  "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors " +
                  (s.selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-transparent")
                }
              >
                <Check className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {it.name}
                </p>
                <p className="text-xs text-zinc-500">{it.unit}</p>
              </div>
              <Stepper
                value={s.qty}
                onChange={(n) =>
                  setSelected((prev) => ({
                    ...prev,
                    [it.product_id]: {
                      selected: prev[it.product_id]?.selected ?? true,
                      qty: n,
                    },
                  }))
                }
              />
            </li>
          );
        })}
      </ul>

      {unmatched.length > 0 && (
        <p className="rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          {unmatched.length} {unmatched.length === 1 ? "Begriff" : "Begriffe"}{" "}
          nicht im Katalog gefunden — du kannst sie über &laquo;Suchen&raquo;
          manuell hinzufügen.
        </p>
      )}

      {canned && (
        <p className="text-[10px] uppercase tracking-wider text-amber-700">
          {copyDe["voice.canned_hint"]}
        </p>
      )}
    </div>
  );
}
