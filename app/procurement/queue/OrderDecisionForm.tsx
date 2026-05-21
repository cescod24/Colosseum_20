"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyEn } from "@/lib/constants/copy.en";

export type QueueLineProp = {
  id: string;
  qty: number;
  unitPrice: number;
  productName: string;
  unit: string;
  supplierName: string;
  hazardous: boolean;
};

export type SuggestionOption = {
  id: string;
  name: string;
  supplierName: string;
  unit: string;
};

type LineDecision = {
  decision: "approve" | "decline";
  reason: string;
  suggestedProductId: string;
  suggestedQty: string;
};

type Props = {
  orderId: string;
  currency: string;
  lines: QueueLineProp[];
  suggestions: SuggestionOption[];
};

const fmtCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-CH", { style: "currency", currency }).format(value);

function initialState(lines: QueueLineProp[]): Record<string, LineDecision> {
  return Object.fromEntries(
    lines.map((l) => [
      l.id,
      {
        decision: "approve" as const,
        reason: "",
        suggestedProductId: "",
        suggestedQty: "",
      },
    ]),
  );
}

export function OrderDecisionForm({
  orderId,
  currency,
  lines,
  suggestions,
}: Props) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Record<string, LineDecision>>(() =>
    initialState(lines),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approvedTotal = useMemo(() => {
    return (
      Math.round(
        lines.reduce((sum, l) => {
          if (decisions[l.id]?.decision !== "approve") return sum;
          return sum + Number(l.qty) * Number(l.unitPrice);
        }, 0) * 100,
      ) / 100
    );
  }, [decisions, lines]);

  function setLine(id: string, patch: Partial<LineDecision>) {
    setDecisions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function setAll(decision: "approve" | "decline") {
    setDecisions((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, v]) => [id, { ...v, decision }]),
      ),
    );
  }

  function submit(payload: Record<string, LineDecision>) {
    setError(null);
    startTransition(async () => {
      const body = {
        lines: lines.map((l) => {
          const d = payload[l.id];
          if (d.decision === "approve") {
            return { order_item_id: l.id, decision: "approve" as const };
          }
          return {
            order_item_id: l.id,
            decision: "decline" as const,
            reason: d.reason.trim() || null,
            suggested_product_id: d.suggestedProductId || null,
            suggested_qty: d.suggestedQty.trim() ? d.suggestedQty.trim() : null,
          };
        }),
      };

      const res = await fetch(`/api/orders/${orderId}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Decision failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-t border-zinc-100">
      <div className="grid grid-cols-1 gap-2 bg-zinc-50 px-5 py-3 sm:flex sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-600">
          {copyEn["queue.decision.approved_total"]}:{" "}
          <span className="font-semibold text-zinc-900">
            {fmtCurrency(approvedTotal, currency)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAll("approve");
              submit(
                Object.fromEntries(
                  Object.entries(decisions).map(([id, v]) => [
                    id,
                    { ...v, decision: "approve" as const },
                  ]),
                ),
              );
            }}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {copyEn["queue.decision.approve_all"]}
          </button>
          <button
            type="button"
            onClick={() => {
              setAll("decline");
              submit(
                Object.fromEntries(
                  Object.entries(decisions).map(([id, v]) => [
                    id,
                    { ...v, decision: "decline" as const },
                  ]),
                ),
              );
            }}
            disabled={pending}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-60"
          >
            {copyEn["queue.decision.reject_all"]}
          </button>
        </div>
      </div>

      <ul className="divide-y divide-zinc-100">
        {lines.map((line) => {
          const d = decisions[line.id];
          const lineTotal =
            Math.round(Number(line.qty) * Number(line.unitPrice) * 100) / 100;
          return (
            <li key={line.id} className="px-5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900">
                    {line.productName}
                    {line.hazardous && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {copyEn["queue.hazardous_flag"]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {line.supplierName} · {Number(line.qty)} {line.unit} ·{" "}
                    {fmtCurrency(Number(line.unitPrice), currency)} →{" "}
                    <span className="font-medium text-zinc-700">
                      {fmtCurrency(lineTotal, currency)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-zinc-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setLine(line.id, { decision: "approve" })}
                    className={
                      d.decision === "approve"
                        ? "bg-emerald-600 px-3 py-1.5 font-medium text-white"
                        : "bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                    }
                  >
                    {copyEn["queue.decision.line_approve"]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLine(line.id, { decision: "decline" })}
                    className={
                      d.decision === "decline"
                        ? "bg-red-600 px-3 py-1.5 font-medium text-white"
                        : "bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
                    }
                  >
                    {copyEn["queue.decision.line_decline"]}
                  </button>
                </div>
              </div>

              {d.decision === "decline" && (
                <div className="mt-3 space-y-2 rounded-lg bg-red-50/50 p-3">
                  <label className="block text-xs font-medium text-zinc-700">
                    {copyEn["queue.decision.reason_label"]}
                    <textarea
                      value={d.reason}
                      onChange={(e) => setLine(line.id, { reason: e.target.value })}
                      rows={2}
                      placeholder={copyEn["queue.decision.reason_placeholder"]}
                      className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                    <label className="block text-xs font-medium text-zinc-700">
                      {copyEn["queue.decision.suggest_label"]}
                      <select
                        value={d.suggestedProductId}
                        onChange={(e) =>
                          setLine(line.id, {
                            suggestedProductId: e.target.value,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
                      >
                        <option value="">
                          {copyEn["queue.decision.suggest_none"]}
                        </option>
                        {suggestions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {s.supplierName} ({s.unit})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-zinc-700">
                      {copyEn["queue.decision.suggest_qty_label"]}
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={d.suggestedQty}
                        onChange={(e) =>
                          setLine(line.id, { suggestedQty: e.target.value })
                        }
                        disabled={!d.suggestedProductId}
                        placeholder={String(Number(line.qty))}
                        className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none disabled:bg-zinc-50"
                      />
                    </label>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-white px-5 py-3">
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => submit(decisions)}
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending
              ? copyEn["queue.decision.submitting"]
              : copyEn["queue.decision.submit"]}
          </button>
        </div>
      </div>
    </div>
  );
}
