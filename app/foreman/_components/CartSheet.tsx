"use client";

import { Loader2, ShoppingCart, X } from "lucide-react";

import { copyDe, formatCopy } from "@/lib/constants/copy.de";
import type { CatalogProduct } from "@/lib/data/foreman";

import { Stepper } from "./Stepper";

// Bottom drawer (mobile sheet) for the cart. Opens when the cart icon in
// BottomNavBar is tapped. Owns no state itself — parent passes everything.
// The foreman never sees prices (CLAUDE.md): no per-item price, no total —
// procurement owns the cost side. The server recomputes the total + applies
// the threshold on submit.

type Props = {
  open: boolean;
  onClose: () => void;
  cart: Array<{ product_id: string; qty: number }>;
  productById: Map<string, CatalogProduct>;
  state: "idle" | "sending" | "queued" | "error";
  online: boolean;
  onChangeQty: (product_id: string, qty: number) => void;
  onSubmit: () => void;
};

export function CartSheet({
  open,
  onClose,
  cart,
  productById,
  state,
  online,
  onChangeQty,
  onSubmit,
}: Props) {
  if (!open) return null;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const empty = cart.length === 0;
  const showQueued = !online || state === "queued";
  const sending = state === "sending";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-900/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mx-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={copyDe["cart_sheet.title"]}
      >
        <header className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {copyDe["cart_sheet.title"]}
            </h2>
            <p className="text-xs text-zinc-500">
              {formatCopy(copyDe["orders.items"], { count: itemCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copyDe["cart_sheet.close"]}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-[120px] flex-1 overflow-y-auto px-4">
          {empty ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
              {copyDe["cart_sheet.empty"]}
            </p>
          ) : (
            <ul className="space-y-2 pb-2">
              {cart.map((line) => {
                const p = productById.get(line.product_id);
                if (!p) return null;
                return (
                  <li
                    key={line.product_id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-100 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {p.name}
                      </p>
                      <p className="text-xs text-zinc-500">{p.unit}</p>
                    </div>
                    <Stepper
                      value={line.qty}
                      onChange={(n) => onChangeQty(line.product_id, n)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="space-y-2 border-t border-zinc-100 bg-white px-4 py-3">
          {showQueued && itemCount > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-900">
              {copyDe["cart.offline"]}
            </p>
          )}
          {state === "error" && (
            <p className="rounded-md bg-rose-50 px-3 py-1 text-xs text-rose-900">
              {copyDe["cart.error"]}
            </p>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={empty || sending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ShoppingCart className="h-5 w-5" />
            )}
            <span>
              {sending
                ? copyDe["cart.sending"]
                : empty
                  ? copyDe["cart.empty"]
                  : copyDe["cart.submit"]}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}
