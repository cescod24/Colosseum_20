"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
  type AssistantTurn,
} from "@/lib/schema";

import { Stepper } from "./Stepper";

// Full-screen sheet that hosts the conversational assistant.
//
// Opens when the center AI button in BottomNavBar is tapped. Manages:
//   - a mini conversation history (last 4 turns, persisted in-memory)
//   - audio recording via MediaRecorder
//   - text input for typing instead of speaking
//   - rendering the assistant's reply, suggested items, alternatives,
//     and removal hints, each with one-tap apply buttons
//
// Receives everything it needs from the parent: addToCart, removeFromCart,
// projectId, cart snapshot (for context).

type CartLineLite = { product_id: string; qty: number };

type Props = {
  open: boolean;
  onClose: () => void;
  addToCart: (product_id: string, qty: number) => void;
  removeFromCart: (product_id: string) => void;
  projectId?: string;
  cart: CartLineLite[];
};

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      items: AssistantItem[];
      alternatives: AssistantItem[];
      removals: string[]; // supplier_skus
      followUp: string | null;
      canned?: boolean;
      redirect?: boolean;
    };

type Status =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "processing" }
  | { kind: "denied" }
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

function buildHistory(messages: Message[]): AssistantTurn[] {
  return messages
    .slice(-4)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, text: m.text }
        : { role: "assistant" as const, text: m.text },
    );
}

export function AssistantSheet({
  open,
  onClose,
  addToCart,
  removeFromCart,
  projectId,
  cart,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [text, setText] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Scroll latest message into view.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  // Cleanup on close + unmount.
  useEffect(() => {
    if (!open) {
      stopStream();
    }
    return () => stopStream();
  }, [open]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  const handleResponse = useCallback(
    (body: AssistantResponse) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: body.reply,
          items: body.items,
          alternatives: body.alternatives,
          removals: body.removals,
          followUp: body.follow_up,
          canned: body.canned,
          redirect: body.redirect,
        },
      ]);
    },
    [],
  );

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
          form.append("history", JSON.stringify(buildHistory(messages)));
          form.append("cart", JSON.stringify(cart));
          res = await fetch("/api/voice", { method: "POST", body: form });
        } else {
          res = await fetch("/api/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: init.userText,
              project_id: projectId,
              history: buildHistory(messages),
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
        const body = parsed.data;
        // Surface the user's effective utterance into the chat.
        const userUtterance = init.userText ?? body.transcript;
        setMessages((prev) =>
          userUtterance ? [...prev, { role: "user", text: userUtterance }] : prev,
        );
        handleResponse(body);
        setStatus({ kind: "idle" });
      } catch (err) {
        console.warn("[assistant] request failed", err);
        setStatus({ kind: "error", message: copyDe["assistant.error"] });
      }
    },
    [cart, handleResponse, messages, projectId],
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
        const startedAt =
          status.kind === "recording" ? status.startedAt : Date.now();
        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        stopStream();
        if (elapsed < 500 || blob.size < 4096) {
          setStatus({
            kind: "error",
            message: "Halt das Mikrofon etwas länger gedrückt.",
          });
          return;
        }
        void sendRequest({ audioBlob: blob }, rec.mimeType);
      };
      rec.start();
      setStatus({ kind: "recording", startedAt: Date.now() });
    } catch (err) {
      console.warn("[assistant] mic permission denied", err);
      stopStream();
      setStatus({ kind: "denied" });
    }
  }, [sendRequest, status]);

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
    if (status.kind === "processing") return;
    void startRecording();
  }

  if (!open) return null;

  const recording = status.kind === "recording";
  const processing = status.kind === "processing";

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
              <p className="text-[11px] text-zinc-500">{copyDe["assistant.subtitle"]}</p>
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

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="rounded-2xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              {copyDe["assistant.empty_intro"]}
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              addToCart={addToCart}
              removeFromCart={removeFromCart}
            />
          ))}
          {status.kind === "processing" && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copyDe["assistant.processing"]}
            </div>
          )}
          {status.kind === "denied" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {copyDe["assistant.permission_denied"]}
            </p>
          )}
          {status.kind === "error" && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {status.message}
            </p>
          )}
        </div>

        <footer className="space-y-2 border-t border-zinc-100 bg-white px-4 py-3 pb-6">
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
              disabled={recording || processing}
            />
            <button
              type="button"
              onClick={sendText}
              disabled={!text.trim() || recording || processing}
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
              className={
                "flex h-10 w-12 items-center justify-center rounded-xl shadow-sm transition-colors " +
                (recording
                  ? "bg-rose-600 text-white animate-pulse"
                  : processing
                    ? "bg-zinc-300 text-zinc-500"
                    : "bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-white")
              }
              disabled={processing}
            >
              {recording ? (
                <Square className="h-4 w-4" fill="currentColor" />
              ) : processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  addToCart,
  removeFromCart,
}: {
  message: Message;
  addToCart: (product_id: string, qty: number) => void;
  removeFromCart: (product_id: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-zinc-900 px-3 py-2 text-sm text-white">
          {message.text}
        </p>
      </div>
    );
  }

  // assistant
  const { items, alternatives, removals, followUp, redirect } = message;

  return (
    <div className="flex flex-col items-start gap-2">
      {redirect && (
        <div className="flex w-full max-w-[85%] items-start gap-2 rounded-2xl rounded-tl-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}
      {!redirect && (
        <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-zinc-100 px-3 py-2 text-sm text-zinc-900">
          {message.text}
        </p>
      )}

      {items.length > 0 && (
        <AssistantItemList
          label={copyDe["assistant.suggestions_label"]}
          items={items}
          applyLabel={copyDe["assistant.apply_items"]}
          onApply={(items) => items.forEach((it) => addToCart(it.product_id, it.qty))}
        />
      )}
      {alternatives.length > 0 && (
        <AssistantItemList
          label={copyDe["assistant.alternatives_label"]}
          items={alternatives}
          applyLabel={copyDe["assistant.apply_alts"]}
          onApply={(items) => items.forEach((it) => addToCart(it.product_id, it.qty))}
        />
      )}
      {removals.length > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            {copyDe["assistant.removals_label"]}
          </p>
          <ul className="text-sm text-zinc-700">
            {removals.map((sku) => (
              <li key={sku}>· {sku}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => removals.forEach((sku) => removeFromCart(sku))}
            className="mt-1 self-end rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white"
          >
            {copyDe["assistant.apply_removals"]}
          </button>
        </div>
      )}

      {followUp && (
        <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-zinc-50 px-3 py-1.5 text-xs italic text-zinc-600">
          {followUp}
        </p>
      )}

      {message.canned && (
        <span className="text-[10px] uppercase tracking-wider text-amber-700">
          {copyDe["voice.canned_hint"]}
        </span>
      )}
    </div>
  );
}

function AssistantItemList({
  label,
  items,
  applyLabel,
  onApply,
}: {
  label: string;
  items: AssistantItem[];
  applyLabel: string;
  onApply: (items: AssistantItem[]) => void;
}) {
  const [localQtys, setLocalQtys] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.product_id] = it.qty;
    return m;
  });

  // If items list changes (new turn), reseed.
  useEffect(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.product_id] = it.qty;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalQtys(m);
  }, [items]);

  return (
    <div className="w-full max-w-[100%] space-y-1.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      <ul className="space-y-1.5">
        {items.map((it) => {
          const qty = localQtys[it.product_id] ?? it.qty;
          return (
            <li
              key={it.product_id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{it.name}</p>
                <p className="text-xs text-zinc-500">{it.unit}</p>
              </div>
              <Stepper
                value={qty}
                onChange={(n) => setLocalQtys((prev) => ({ ...prev, [it.product_id]: n }))}
              />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() =>
          onApply(items.map((it) => ({ ...it, qty: localQtys[it.product_id] ?? it.qty })))
        }
        className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700"
      >
        {applyLabel}
      </button>
    </div>
  );
}
