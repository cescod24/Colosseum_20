"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copyDe } from "@/lib/constants/copy.de";

const CART_STORAGE_KEY = "siteorder.cart.v1";
const DISMISSED_SUGGESTIONS_KEY = "siteorder.suggestions.dismissed.v1";

export type LineRow = {
  id: string;
  productName: string;
  unit: string;
  qty: number;
  lineStatus: "approved" | "rejected";
  declineReason: string | null;
  suggested: {
    productId: string;
    name: string;
    unit: string;
    qty: number;
  } | null;
};

type Props = {
  lines: LineRow[];
};

type CartLine = { product_id: string; qty: number };

function loadCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return parsed.filter((l) => l && l.product_id && l.qty > 0);
  } catch {
    return [];
  }
}

function persistCart(lines: CartLine[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}

function loadDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persistDismissed(set: Set<string>) {
  try {
    window.localStorage.setItem(
      DISMISSED_SUGGESTIONS_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    /* ignore */
  }
}

export function LineDecisionsList({ lines }: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDismissed(loadDismissed());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function acceptSuggestion(lineId: string, productId: string, qty: number) {
    const cart = loadCart();
    const idx = cart.findIndex((l) => l.product_id === productId);
    if (idx >= 0) {
      cart[idx] = { ...cart[idx], qty: cart[idx].qty + qty };
    } else {
      cart.push({ product_id: productId, qty });
    }
    persistCart(cart);
    setAcceptedFor(lineId);
    setTimeout(() => router.push("/foreman"), 800);
  }

  function declineSuggestion(lineId: string) {
    const next = new Set(dismissed);
    next.add(lineId);
    setDismissed(next);
    persistDismissed(next);
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {lines.map((line) => {
        const isRejected = line.lineStatus === "rejected";
        const showSuggestion =
          isRejected && line.suggested && !dismissed.has(line.id);
        return (
          <li
            key={line.id}
            className={
              isRejected ? "bg-red-50/40 px-2 py-2 -mx-2 rounded-lg" : "py-2"
            }
          >
            <div className="flex items-center justify-between text-sm">
              <span
                className={
                  isRejected
                    ? "text-zinc-500 line-through"
                    : "text-zinc-900"
                }
              >
                {line.productName}
              </span>
              <span
                className={
                  isRejected ? "text-zinc-500 line-through" : "text-zinc-600"
                }
              >
                {Number(line.qty)} {line.unit}
              </span>
            </div>

            {isRejected && line.declineReason && (
              <p className="mt-1 text-xs text-red-700">
                <span className="font-medium">
                  {copyDe["order_detail.declined_reason"]}:
                </span>{" "}
                {line.declineReason}
              </p>
            )}

            {isRejected && !line.declineReason && (
              <p className="mt-1 text-xs text-red-700">
                {copyDe["order_detail.declined_no_reason"]}
              </p>
            )}

            {showSuggestion && line.suggested && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-800">
                  {copyDe["order_detail.suggestion_label"]}
                </p>
                <p className="mt-1 text-sm text-zinc-900">
                  {line.suggested.name}{" "}
                  <span className="text-zinc-600">
                    · {Number(line.suggested.qty)} {line.suggested.unit}
                  </span>
                </p>
                {acceptedFor === line.id ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    {copyDe["order_detail.suggestion_accepted"]}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        acceptSuggestion(
                          line.id,
                          line.suggested!.productId,
                          line.suggested!.qty,
                        )
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      {copyDe["order_detail.suggestion_accept"]}
                    </button>
                    <button
                      type="button"
                      onClick={() => declineSuggestion(line.id)}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400"
                    >
                      {copyDe["order_detail.suggestion_decline"]}
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
