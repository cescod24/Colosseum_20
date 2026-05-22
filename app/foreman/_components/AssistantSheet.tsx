"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

import { copyDe } from "@/lib/constants/copy.de";
import {
  assistantResponseSchema,
  type AssistantItem,
  type AssistantResponse,
  type CartRemoval,
} from "@/lib/schema";

import { Stepper } from "./Stepper";

// Action-oriented assistant sheet.
//
// Foremen don't chat. The user speaks/types once, the assistant returns a
// concrete item recommendation, the user reviews (checkbox + Stepper +
// unit-aware step), and one tap MERGES the items into the cart. The final
// "Bestellung senden" still lives in the CartSheet so the foreman has one
// last total-visible confirmation before the order goes out.

type CartLineLite = { product_id: string; qty: number };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  /** Foreman's current cart — passed to the AI as context. The AI uses it
   *  both to avoid re-suggesting cart items and to enact removals when the
   *  polier says "togli quello che hai aggiunto" / "remove the X". */
  cart: CartLineLite[];
  /** Same mutator the rest of the foreman pages use (kit tiles, last order,
   *  most-ordered). The assistant adds its picked items here; submit still
   *  goes through the CartSheet. */
  addToCart: (product_id: string, qty: number) => void;
  /** Used when the AI returns `cart_removals` — items already in the cart
   *  that the polier asked to remove. Pages without a real cart (e.g. an
   *  orders-only screen) can pass a no-op. */
  removeFromCart?: (product_id: string) => void;
};

// Step size based on the product's unit. Foremen order screws by tens, tape
// by ones — +/-1 on a Stk line is too tedious to use.
function stepFor(unit: string | null | undefined): number {
  if (!unit) return 1;
  if (unit === "Stk") return 10;
  if (unit === "m") return 5;
  return 1;
}

type SelectedMap = Record<string, { selected: boolean; qty: number }>;

type Status =
  | { kind: "idle" }
  | { kind: "denied" }
  | { kind: "recording"; startedAt: number }
  | { kind: "processing"; refineCount: number }
  | {
      kind: "result";
      transcript: string;
      reply: string;
      items: AssistantItem[];
      /** Items already in the cart that the polier asked to remove. */
      cartRemovals: CartRemoval[];
      unmatched: AssistantResponse["unmatched"];
      canned?: boolean;
    }
  | { kind: "blocked"; transcript: string; message: string }
  | { kind: "applied"; count: number }
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

export function AssistantSheet({
  open,
  onClose,
  projectId,
  cart,
  addToCart,
  removeFromCart,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<SelectedMap>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  // See plan.md §13.4b — never read React state inside rec.onstop; the React
  // closure is stale by the time the callback fires. Use this ref instead.
  const recordingStartedAtRef = useRef<number | null>(null);
  // When the polier continues talking after a first result, we POST the
  // current items as refinement context so the server preserves anything
  // the polier didn't mention. Set when result lands, cleared on Add-to-cart
  // / discard / close.
  const refineItemsRef = useRef<{ supplier_sku: string; qty: number }[] | null>(
    null,
  );

  // Reset when closing.
  useEffect(() => {
    if (!open) {
      stopStream();
      refineItemsRef.current = null;
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
      refineItemsRef.current = null;
      setStatus({
        kind: "blocked",
        transcript: body.transcript,
        message: body.message ?? body.reply ?? copyDe["voice.blocked"],
      });
      return;
    }
    if (body.items.length === 0) {
      // Keep refineItemsRef intact — the polier might rephrase and we still
      // want the next turn to know what was on the table.
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
    // Remember the proposal so a follow-up voice/text turn can refine it.
    refineItemsRef.current = body.items.map((i) => ({
      supplier_sku: i.supplier_sku,
      qty: i.qty,
    }));
    setStatus({
      kind: "result",
      transcript: body.transcript,
      reply: body.reply,
      items: body.items,
      cartRemovals: body.cart_removals ?? [],
      unmatched: body.unmatched,
      canned: body.canned,
    });
  }, []);

  const sendRequest = useCallback(
    async (init: { audioBlob?: Blob; userText?: string }, mimeType?: string) => {
      const refineItems = refineItemsRef.current;
      const refineCount =
        refineItems && refineItems.length > 0 ? refineItems.length : 0;
      setStatus({ kind: "processing", refineCount });
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
          if (refineItems && refineItems.length > 0) {
            form.append("current_items", JSON.stringify(refineItems));
          }
          res = await fetch("/api/voice", { method: "POST", body: form });
        } else {
          res = await fetch("/api/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: init.userText,
              project_id: projectId,
              cart,
              current_items: refineItems ?? undefined,
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
        // Server is authoritative for refinement merging — it runs the
        // reverse-synonym preservation pass in app/api/voice/route.ts. We
        // used to also merge here, but the client check only saw German
        // tokens, so "togli i guanti" wouldn't match "Arbeitshandschuhe"
        // and the client restored items the server correctly removed.
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
      console.warn("[assistant] mic failed", err);
      recordingStartedAtRef.current = null;
      stopStream();
      // Surface the real cause so the foreman knows what to fix.
      const e = err as { name?: string; message?: string } | undefined;
      const insecure =
        typeof window !== "undefined" && !window.isSecureContext;
      if (insecure || e?.name === "SecurityError") {
        setStatus({
          kind: "error",
          message: copyDe["assistant.mic_insecure"],
        });
      } else if (e?.name === "NotAllowedError") {
        setStatus({ kind: "denied" });
      } else if (e?.name === "NotFoundError") {
        setStatus({
          kind: "error",
          message: copyDe["assistant.mic_not_found"],
        });
      } else if (e?.name === "NotReadableError") {
        setStatus({
          kind: "error",
          message: copyDe["assistant.mic_in_use"],
        });
      } else {
        setStatus({ kind: "denied" });
      }
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
    if (status.kind === "processing" || status.kind === "applied") return;
    void startRecording();
  }

  const selectedCount =
    status.kind === "result"
      ? status.items.filter((it) => {
          const s = selected[it.product_id];
          return s?.selected && s.qty > 0;
        }).length
      : 0;

  // Merge picked items into the cart AND apply cart_removals if the AI
  // surfaced any. The final "Bestellung senden" still happens in the
  // CartSheet — we just stage edits to the cart here. Foreman never sees
  // prices, so no total is shown on review.
  const applyToCart = useCallback(() => {
    if (status.kind !== "result") return;
    const picked = status.items.filter((it) => {
      const s = selected[it.product_id];
      return s?.selected && s.qty > 0;
    });
    const removals = status.cartRemovals;
    if (picked.length === 0 && removals.length === 0) return;
    for (const it of picked) {
      const qty = selected[it.product_id]?.qty ?? it.qty;
      addToCart(it.product_id, qty);
    }
    if (removals.length > 0 && removeFromCart) {
      for (const r of removals) removeFromCart(r.product_id);
    }
    refineItemsRef.current = null;
    setStatus({
      kind: "applied",
      count: picked.length + removals.length,
    });
    setTimeout(() => onClose(), 900);
  }, [addToCart, removeFromCart, onClose, selected, status]);

  if (!open) return null;

  const recording = status.kind === "recording";
  const processing = status.kind === "processing";
  const applied = status.kind === "applied";
  const lockInput = recording || processing || applied;

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
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status.kind === "recording"
                  ? copyDe["voice.recording"]
                  : copyDe["assistant.processing"]}
              </div>
              {status.kind === "processing" && status.refineCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {copyDe["assistant.refining_badge"].replace(
                      "{n}",
                      String(status.refineCount),
                    )}
                  </span>
                </div>
              )}
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

          {status.kind === "applied" && (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-6 text-emerald-900">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-base font-semibold">
                {status.count === 1
                  ? "1 Artikel im Warenkorb"
                  : `${status.count} Artikel im Warenkorb`}
              </p>
              <p className="text-sm">
                Tipp unten auf den Warenkorb, um zu senden.
              </p>
            </div>
          )}

          {status.kind === "result" && (
            <ResultPanel
              transcript={status.transcript}
              reply={status.reply}
              canned={status.canned}
              items={status.items}
              cartRemovals={status.cartRemovals}
              unmatched={status.unmatched}
              selected={selected}
              setSelected={setSelected}
            />
          )}
        </div>

        {/* Result → refinement input + "In den Warenkorb" footer */}
        {status.kind === "result" ? (
          <footer className="space-y-3 border-t border-zinc-100 bg-white px-4 py-3 pb-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                <Sparkles className="h-3.5 w-3.5" />
                {copyDe["assistant.refine_hint"]}
              </p>
              <p className="mt-0.5 pl-5 text-[11px] text-amber-800">
                {copyDe["assistant.refine_examples"]}
              </p>
            </div>
            {/* Mic = main action: big circular button on top. Text input
                is the fallback for "I can't talk right now." */}
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={onMicTap}
                aria-label={
                  recording
                    ? copyDe["assistant.stop_listening"]
                    : copyDe["assistant.start_listening"]
                }
                disabled={processing || applied}
                className={
                  "flex h-16 w-16 items-center justify-center rounded-full shadow-md ring-4 ring-white transition-all active:scale-95 " +
                  (recording
                    ? "bg-rose-600 text-white animate-pulse"
                    : processing || applied
                      ? "bg-zinc-300 text-zinc-500"
                      : "bg-gold text-zinc-900 hover:scale-105")
                }
              >
                {recording ? (
                  <Square className="h-6 w-6" fill="currentColor" />
                ) : processing || applied ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-7 w-7" />
                )}
              </button>
              <span
                className={
                  "text-[11px] font-medium " +
                  (recording
                    ? "text-rose-700"
                    : processing || applied
                      ? "text-zinc-500"
                      : "text-zinc-700")
                }
              >
                {recording
                  ? copyDe["voice.recording"]
                  : processing || applied
                    ? copyDe["voice.processing"]
                    : copyDe["assistant.start_listening"]}
              </span>
            </div>
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
                placeholder={copyDe["assistant.refine_placeholder"]}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={sendText}
                disabled={!text.trim()}
                aria-label={copyDe["assistant.send"]}
                className="rounded-xl bg-brand px-3 py-1.5 text-white shadow-sm disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={applyToCart}
              disabled={selectedCount === 0}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            >
              <Check className="h-5 w-5" />
              <span>
                {selectedCount === 0
                  ? copyDe["assistant.no_match"]
                  : copyDe["voice.apply"]}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                refineItemsRef.current = null;
                setStatus({ kind: "idle" });
                setSelected({});
              }}
              className="block w-full text-center text-xs text-zinc-500 hover:text-zinc-900"
            >
              {copyDe["assistant.discard"]}
            </button>
          </footer>
        ) : status.kind === "applied" || status.kind === "blocked" ? (
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
          <footer className="space-y-3 border-t border-zinc-100 bg-white px-4 py-3 pb-6">
            {/* Mic = main action: big circular button on top. Text input
                stays as a thin fallback for "I can't talk right now." */}
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={onMicTap}
                aria-label={
                  recording
                    ? copyDe["assistant.stop_listening"]
                    : copyDe["assistant.start_listening"]
                }
                disabled={processing || applied}
                className={
                  "flex h-16 w-16 items-center justify-center rounded-full shadow-md ring-4 ring-white transition-all active:scale-95 " +
                  (recording
                    ? "bg-rose-600 text-white animate-pulse"
                    : processing || applied
                      ? "bg-zinc-300 text-zinc-500"
                      : "bg-gold text-zinc-900 hover:scale-105")
                }
              >
                {recording ? (
                  <Square className="h-6 w-6" fill="currentColor" />
                ) : processing || applied ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-7 w-7" />
                )}
              </button>
              <span
                className={
                  "text-[11px] font-medium " +
                  (recording
                    ? "text-rose-700"
                    : processing || applied
                      ? "text-zinc-500"
                      : "text-zinc-700")
                }
              >
                {recording
                  ? copyDe["voice.recording"]
                  : processing || applied
                    ? copyDe["voice.processing"]
                    : copyDe["assistant.start_listening"]}
              </span>
            </div>
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
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                disabled={lockInput}
              />
              <button
                type="button"
                onClick={sendText}
                disabled={!text.trim() || lockInput}
                aria-label={copyDe["assistant.send"]}
                className="rounded-xl bg-brand px-3 py-1.5 text-white shadow-sm disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                <Send className="h-4 w-4" />
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
  cartRemovals,
  unmatched,
  selected,
  setSelected,
}: {
  transcript: string;
  reply: string;
  canned?: boolean;
  items: AssistantItem[];
  cartRemovals: CartRemoval[];
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
                step={stepFor(it.unit)}
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

      {cartRemovals.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
            {copyDe["assistant.cart_removals_label"]}
          </p>
          <ul className="mt-1.5 space-y-1">
            {cartRemovals.map((r) => (
              <li
                key={r.product_id}
                className="flex items-center justify-between gap-2 text-sm text-rose-900"
              >
                <span className="truncate">— {r.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-rose-700">
                  {r.supplier_sku}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-rose-700">
            {copyDe["assistant.cart_removals_hint"]}
          </p>
        </div>
      )}

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
