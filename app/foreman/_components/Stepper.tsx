"use client";

import { Minus, Plus } from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
};

export function Stepper({ value, onChange, min = 0, step = 1 }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={copyDe["qty.minus"]}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 transition-colors hover:border-zinc-400 active:bg-zinc-100"
      >
        <Minus className="h-5 w-5" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[2ch] text-center text-base font-semibold tabular-nums text-zinc-900"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={copyDe["qty.plus"]}
        onClick={() => onChange(value + step)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
