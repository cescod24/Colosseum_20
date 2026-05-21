"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { copyDe, formatCopy } from "@/lib/constants/copy.de";

type Props = {
  total: number;
  itemCount: number;
  state: "idle" | "sending" | "queued" | "error";
  online: boolean;
  onSubmit: () => void;
  disabled?: boolean;
};

export function CartBar({ total, itemCount, state, online, onSubmit, disabled }: Props) {
  const showQueued = !online || state === "queued";
  const sending = state === "sending";
  const empty = itemCount === 0;
  const label = empty
    ? copyDe["cart.empty"]
    : formatCopy(copyDe["cart.submit_with_total"], { total: total.toFixed(2) });

  return (
    <div className="sticky bottom-0 z-10 w-full border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      {showQueued && itemCount > 0 && (
        <p className="mb-2 rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-900">
          {copyDe["cart.offline"]}
        </p>
      )}
      {state === "error" && (
        <p className="mb-2 rounded-md bg-rose-50 px-3 py-1 text-xs text-rose-900">
          {copyDe["cart.error"]}
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={empty || disabled || sending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {sending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ShoppingCart className="h-5 w-5" />
        )}
        <span>{sending ? copyDe["cart.sending"] : label}</span>
      </button>
    </div>
  );
}
