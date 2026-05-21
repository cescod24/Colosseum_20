"use client";

import { Wifi, WifiOff } from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";

type Props = {
  forcedOffline: boolean;
  onToggle: (next: boolean) => void;
};

export function OfflineToggle({ forcedOffline, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!forcedOffline)}
      aria-pressed={forcedOffline}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors " +
        (forcedOffline
          ? "bg-amber-100 text-amber-900"
          : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400")
      }
    >
      {forcedOffline ? (
        <WifiOff className="h-3.5 w-3.5" />
      ) : (
        <Wifi className="h-3.5 w-3.5" />
      )}
      {forcedOffline ? copyDe["offline.toggle_off"] : copyDe["offline.toggle_on"]}
    </button>
  );
}
