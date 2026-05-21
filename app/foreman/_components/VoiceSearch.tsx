"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";

// Web Speech API wiring. Pipes the spoken transcript into the existing
// DiscoverClient search input via the onTranscript callback. The parent
// owns the search state + submit; this component is purely an input
// alternative to typing.

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function VoiceSearch({ onTranscript, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(Boolean(ctor));
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function start() {
    if (listening) return;
    const ctor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!ctor) return;
    const rec = new ctor();
    rec.lang = "de-CH";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript.trim();
      if (transcript) onTranscript(transcript);
    };
    rec.onerror = (ev) => {
      setError(ev.error ?? "voice-error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  const Icon = listening ? Loader2 : error ? MicOff : Mic;

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={disabled}
      aria-label={
        listening
          ? copyDe["voice.stop"]
          : error
            ? copyDe["voice.retry"]
            : copyDe["voice.start"]
      }
      title={
        listening
          ? copyDe["voice.stop"]
          : error
            ? copyDe["voice.retry"]
            : copyDe["voice.start"]
      }
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors " +
        (listening
          ? "bg-red-100 text-red-700"
          : error
            ? "border border-amber-300 bg-amber-50 text-amber-800"
            : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400")
      }
    >
      <Icon className={`h-4 w-4 ${listening ? "animate-spin" : ""}`} />
    </button>
  );
}
