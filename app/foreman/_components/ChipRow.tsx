"use client";

import { chipsFor } from "@/lib/constants/chips";
import { copyDe, formatCopy } from "@/lib/constants/copy.de";

type Props = {
  unit: string;
  selected: number;
  onSelect: (n: number) => void;
};

export function ChipRow({ unit, selected, onSelect }: Props) {
  const chips = chipsFor(unit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((n) => {
        const active = n === selected;
        return (
          <button
            key={n}
            type="button"
            aria-label={formatCopy(copyDe["qty.preset"], { n })}
            onClick={() => onSelect(n)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (active
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400")
            }
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
