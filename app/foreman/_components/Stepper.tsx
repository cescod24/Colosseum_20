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
      {/* Tappable + typeable. inputMode="numeric" pops the numeric keypad on
          mobile so the foreman can punch in a quantity directly; the +/-
          buttons stay for one-handed nudging. type="text" (not "number")
          avoids the iOS spinner quirks while keeping the numeric keypad. */}
      <input
        type="text"
        inputMode="numeric"
        aria-label={copyDe["qty.label"]}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits === "" ? min : Math.max(min, parseInt(digits, 10)));
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 w-12 rounded-xl border border-zinc-200 bg-white text-center text-base font-semibold tabular-nums text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300"
      />
      <button
        type="button"
        aria-label={copyDe["qty.plus"]}
        onClick={() => onChange(value + step)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-hover active:bg-brand-hover"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
