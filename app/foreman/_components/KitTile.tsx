"use client";

import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  Check,
  HardHat,
  Paintbrush,
  Plug,
  Wrench,
} from "lucide-react";
import { copyDe, formatCopy } from "@/lib/constants/copy.de";

type Props = {
  name: string;
  itemCount: number;
  onTap: () => void;
};

const ADDED_FEEDBACK_MS = 1200;

export function KitTile({ name, itemCount, onTap }: Props) {
  const [added, setAdded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const lower = name.toLowerCase();
  const icon = lower.includes("ppe") ? (
    <HardHat className="h-5 w-5" />
  ) : lower.includes("elektro") ? (
    <Plug className="h-5 w-5" />
  ) : lower.includes("maler") || lower.includes("farbe") ? (
    <Paintbrush className="h-5 w-5" />
  ) : lower.includes("werkzeug") ? (
    <Wrench className="h-5 w-5" />
  ) : (
    <Boxes className="h-5 w-5" />
  );

  function handleTap() {
    onTap();
    setAdded(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAdded(false);
      timerRef.current = null;
    }, ADDED_FEEDBACK_MS);
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-live="polite"
      aria-label={
        added
          ? formatCopy(copyDe["kits.added"], { name })
          : `${name} — ${formatCopy(copyDe["kits.items"], { count: itemCount })}`
      }
      className={
        "relative flex h-full w-full flex-col items-start gap-2 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 " +
        (added
          ? "border-emerald-400 bg-emerald-50 scale-[0.98]"
          : "border-zinc-200 bg-white hover:border-zinc-400 active:bg-zinc-50")
      }
    >
      <span
        className={
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 " +
          (added ? "bg-emerald-600 text-white" : "bg-brand text-white")
        }
      >
        {added ? (
          <Check className="h-5 w-5 animate-[pop_300ms_ease-out]" />
        ) : (
          icon
        )}
      </span>
      <span className="text-sm font-semibold leading-tight text-zinc-900">
        {name}
      </span>
      <span
        className={
          "text-xs transition-colors duration-200 " +
          (added ? "font-medium text-emerald-700" : "text-zinc-500")
        }
      >
        {added
          ? copyDe["kits.added_inline"]
          : formatCopy(copyDe["kits.items"], { count: itemCount })}
      </span>

      {added && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-emerald-400/60 animate-[pulseRing_900ms_ease-out]"
        />
      )}
    </button>
  );
}
