"use client";

import {
  Boxes,
  Droplet,
  HardHat,
  Hammer,
  Package,
  Paintbrush,
  Plug,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  CATEGORY_KEYS,
  categories,
  type CategoryKey,
} from "@/lib/constants/categories";

// Map Dev C's icon strings (lucide-react component names) to actual imports.
// New keys land here when Dev C adds categories; we'd rather take an import
// hit than `import * as Icons` which bloats the bundle.
const ICON_MAP: Record<string, LucideIcon> = {
  Wrench,
  Plug,
  HardHat,
  Hammer,
  Tape: Tag, // lucide has no "Tape" — Tag reads as a label/sticker
  Tag,
  Droplet,
  Paintbrush,
  Sparkles,
  Boxes,
  Package,
};

type Props = {
  selected: CategoryKey | null;
  onSelect: (key: CategoryKey | null) => void;
};

export function CategoryGrid({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CATEGORY_KEYS.map((key) => {
        const def = categories[key];
        const Icon = ICON_MAP[def.icon] ?? Package;
        const active = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(active ? null : key)}
            aria-pressed={active}
            className={
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center shadow-sm transition-colors " +
              (active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400")
            }
          >
            <span
              className={
                "flex h-9 w-9 items-center justify-center rounded-xl " +
                (active ? "bg-white/15" : "bg-zinc-100")
              }
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-medium leading-tight">
              {def.label_de}
            </span>
          </button>
        );
      })}
    </div>
  );
}
