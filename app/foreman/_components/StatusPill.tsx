"use client";

import { copyDe } from "@/lib/constants/copy.de";

export type OrderStatus =
  | "draft"
  | "pending"
  | "approved"
  | "ordered"
  | "delivered";

const STAGES: ReadonlyArray<{ key: OrderStatus; label: string }> = [
  { key: "draft", label: "Entwurf" },
  { key: "pending", label: "Wartet" },
  { key: "approved", label: "Freigegeben" },
  { key: "ordered", label: "Bestellt" },
  { key: "delivered", label: "Geliefert" },
];

const FILLED_INDEX: Record<OrderStatus, number> = {
  draft: 0,
  pending: 1,
  approved: 2,
  ordered: 3,
  delivered: 4,
};

function tone(status: OrderStatus) {
  switch (status) {
    case "pending":
      return { fill: "bg-amber-500", text: "text-amber-700" };
    case "approved":
      return { fill: "bg-sky-500", text: "text-sky-700" };
    case "ordered":
      return { fill: "bg-emerald-500", text: "text-emerald-700" };
    case "delivered":
      return { fill: "bg-emerald-600", text: "text-emerald-700" };
    default:
      return { fill: "bg-zinc-400", text: "text-zinc-600" };
  }
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const filledTo = FILLED_INDEX[status];
  const { fill, text } = tone(status);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, idx) => {
          const isFilled = idx <= filledTo;
          return (
            <span
              key={stage.key}
              className={
                "h-1.5 flex-1 rounded-full transition-colors " +
                (isFilled ? fill : "bg-zinc-200")
              }
            />
          );
        })}
      </div>
      <p className={`text-[11px] font-medium ${text}`}>
        {copyDe[`orders.status.${status}`] ?? status}
      </p>
    </div>
  );
}
