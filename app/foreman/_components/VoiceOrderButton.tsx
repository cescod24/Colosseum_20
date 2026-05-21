"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, ShieldAlert, Square, X } from "lucide-react";

import { copyDe } from "@/lib/constants/copy.de";
import { voiceResponseSchema, type VoiceItem, type VoiceUnmatched } from "@/lib/schema";

import { Stepper } from "./Stepper";

// ---------------------------------------------------------------------------
// Voice-order FAB + result panel.
//
// Sibling of CartBar on /foreman home. Owns its own MediaRecorder state
// machine; on confirm it just calls addToCart for each resolved line — the
// foreman then submits via the existing CartBar.
//
// Parallel surface to Dev B's VoiceSearch on /foreman/discover (Web Speech
// API, browser-only). This one uses server-side Whisper so it works on every
// laptop / Safari / Firefox.
// ---------------------------------------------------------------------------

type Props = {
  addToCart: (product_id: string, qty: number) => void;
  projectId?: string;
};

type State =
  | { kind: "idle" }
  | { kind: "denied" }
  | { kind: "recording"; startedAt: number }
  | { kind: "processing" }
  | {
      kind: "result";
      transcript: string;
      items: VoiceItem[];
      unmatched: VoiceUnmatched[];
      canned?: boolean;
    }
  | { kind: "blocked"; transcript: string; message: string }
  | { kind: "error"; message: string };

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined; // let the browser pick
}

function extForMime(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  return "webm";
}

export function VoiceOrderButton({ addToCart, projectId }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // Track per-line qty in the result panel so the foreman can adjust before
  // applying. Keyed by product_id.
  const [panelQtys, setPanelQtys] = useState<Record<string, number>>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // When a new result arrives, seed panelQtys from the response. setState
  // here is intentional — we're syncing a derived state cache after the
  // parent state transitions; it runs once per result.
  useEffect(() => {
    if (state.kind === "result") {
      const next: Record<string, number> = {};
      for (const it of state.items) next[it.product_id] = it.qty;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelQtys(next);
    } else if (state.kind === "idle") {
      setPanelQtys({});
    }
  }, [state]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

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
      rec.onstop = async () => {
        const startedAt =
          recorderRef.current && state.kind === "recording"
            ? state.startedAt
            : Date.now();
        const elapsed = Date.now() - startedAt;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        stopStream();

        if (elapsed < 500 || blob.size < 4096) {
          setState({ kind: "error", message: copyDe["voice.too_short"] });
          return;
        }

        setState({ kind: "processing" });
        try {
          const form = new FormData();
          form.append(
            "audio",
            blob,
            `voice.${extForMime(rec.mimeType || "audio/webm")}`,
          );
          if (projectId) form.append("project_id", projectId);
          const res = await fetch("/api/voice", {
            method: "POST",
            body: form,
          });
          const raw = await res.json();
          const parsed = voiceResponseSchema.safeParse(raw);
          if (!parsed.success) {
            console.warn("[voice] response failed schema", parsed.error);
            setState({ kind: "error", message: copyDe["voice.error"] });
            return;
          }
          const body = parsed.data;
          if (body.redirect) {
            setState({
              kind: "blocked",
              transcript: body.transcript,
              message: body.message ?? copyDe["voice.blocked"],
            });
            return;
          }
          if (
            body.transcript.trim() === "" &&
            body.items.length === 0 &&
            body.unmatched.length === 0
          ) {
            setState({ kind: "error", message: copyDe["voice.no_audio"] });
            return;
          }
          if (body.items.length === 0 && body.unmatched.length === 0) {
            setState({ kind: "error", message: copyDe["voice.no_match"] });
            return;
          }
          setState({
            kind: "result",
            transcript: body.transcript,
            items: body.items,
            unmatched: body.unmatched,
            canned: body.canned ?? false,
          });
        } catch (err) {
          console.warn("[voice] submit failed", err);
          setState({ kind: "error", message: copyDe["voice.error"] });
        }
      };
      rec.start();
      setState({ kind: "recording", startedAt: Date.now() });
    } catch (err) {
      console.warn("[voice] permission denied / no mic", err);
      stopStream();
      setState({ kind: "denied" });
    }
  }, [projectId, state, stopStream]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      stopStream();
      setState({ kind: "idle" });
    }
  }, [stopStream]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  function onMainTap() {
    if (state.kind === "recording") {
      stopRecording();
      return;
    }
    if (state.kind === "processing") return;
    void startRecording();
  }

  function apply() {
    if (state.kind !== "result") return;
    for (const it of state.items) {
      const qty = panelQtys[it.product_id] ?? it.qty;
      if (qty > 0) addToCart(it.product_id, qty);
    }
    setState({ kind: "idle" });
  }

  function discard() {
    setState({ kind: "idle" });
  }

  // ----- Render --------------------------------------------------------

  const recording = state.kind === "recording";
  const processing = state.kind === "processing";

  return (
    <>
      {/* Result / blocked / error / denied panel sits just above the FAB. */}
      {(state.kind === "result" ||
        state.kind === "blocked" ||
        state.kind === "error" ||
        state.kind === "denied") && (
        <div className="fixed inset-x-0 bottom-28 z-20 px-3">
          <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
            {state.kind === "result" && <ResultPanel
              state={state}
              panelQtys={panelQtys}
              setPanelQtys={setPanelQtys}
              onApply={apply}
              onDiscard={discard}
            />}
            {state.kind === "blocked" && (
              <BlockedPanel transcript={state.transcript} message={state.message} onClose={discard} />
            )}
            {state.kind === "error" && (
              <ErrorPanel message={state.message} onClose={discard} />
            )}
            {state.kind === "denied" && <DeniedPanel onClose={discard} />}
          </div>
        </div>
      )}

      {/* FAB — sticks above the CartBar (CartBar is ~80 px tall). */}
      <button
        type="button"
        onClick={onMainTap}
        aria-label={
          recording
            ? copyDe["voice.recording"]
            : processing
              ? copyDe["voice.processing"]
              : copyDe["voice.order_button"]
        }
        className={
          "fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors " +
          (recording
            ? "bg-rose-600 text-white animate-pulse"
            : processing
              ? "bg-zinc-900 text-white"
              : "bg-zinc-900 text-white hover:bg-zinc-700")
        }
      >
        {processing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : recording ? (
          <Square className="h-5 w-5" fill="currentColor" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

type ResultPanelProps = {
  state: Extract<State, { kind: "result" }>;
  panelQtys: Record<string, number>;
  setPanelQtys: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onApply: () => void;
  onDiscard: () => void;
};

function ResultPanel({ state, panelQtys, setPanelQtys, onApply, onDiscard }: ResultPanelProps) {
  const itemCount = state.items.length;
  const anyToApply = itemCount > 0 && Object.values(panelQtys).some((q) => q > 0);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            {copyDe["voice.transcript_label"]}
          </p>
          <p className="text-sm italic text-zinc-700">&ldquo;{state.transcript}&rdquo;</p>
        </div>
        {state.canned && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-700">
            {copyDe["voice.canned_hint"]}
          </span>
        )}
      </div>

      {itemCount > 0 && (
        <ul className="space-y-1.5">
          {state.items.map((it) => {
            const qty = panelQtys[it.product_id] ?? it.qty;
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
                  onChange={(n) =>
                    setPanelQtys((prev) => ({ ...prev, [it.product_id]: n }))
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {state.unmatched.length > 0 && (
        <div className="rounded-xl bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600">
          {state.unmatched.map((u, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">
                <span className="font-medium">{u.qty}×</span> {u.name}
              </span>
              <Link
                href={`/foreman/discover?task=${encodeURIComponent(u.name)}`}
                className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
              >
                {copyDe["voice.unmatched_hint"]}
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {copyDe["voice.discard"]}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!anyToApply}
          className="flex-[2] rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {copyDe["voice.apply"]}
        </button>
      </div>
    </>
  );
}

function BlockedPanel({
  transcript,
  message,
  onClose,
}: {
  transcript: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="flex-1 text-sm text-amber-900">
          <p className="text-[10px] uppercase tracking-wider text-amber-800">
            {copyDe["voice.transcript_label"]}
          </p>
          <p className="italic">&ldquo;{transcript}&rdquo;</p>
          <p className="mt-1">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
          aria-label={copyDe["voice.discard"]}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm text-rose-900">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-rose-700 hover:bg-rose-100"
        aria-label={copyDe["voice.discard"]}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DeniedPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm text-zinc-800">{copyDe["voice.permission_denied"]}</p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-zinc-600 hover:bg-zinc-100"
        aria-label={copyDe["voice.discard"]}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
