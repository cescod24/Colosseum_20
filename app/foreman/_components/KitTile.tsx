"use client";

import { Boxes, HardHat, Paintbrush, Plug, Wrench } from "lucide-react";
import { copyDe, formatCopy } from "@/lib/constants/copy.de";

type Props = {
  name: string;
  itemCount: number;
  onTap: () => void;
};

export function KitTile({ name, itemCount, onTap }: Props) {
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
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-zinc-400 active:bg-zinc-50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
        {icon}
      </span>
      <span className="text-sm font-semibold leading-tight text-zinc-900">
        {name}
      </span>
      <span className="text-xs text-zinc-500">
        {formatCopy(copyDe["kits.items"], { count: itemCount })}
      </span>
    </button>
  );
}
