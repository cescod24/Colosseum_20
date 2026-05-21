"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

import { copyDe, formatCopy } from "@/lib/constants/copy.de";
import { getBrowserClient } from "@/lib/supabase/browser";

import { StatusPill, type OrderStatus } from "./StatusPill";

type OrderSummary = {
  id: string;
  status: OrderStatus;
  total: number;
  currency: string;
  created_at: string;
  items: Array<{ qty: number; product_id: string }>;
};

type Props = {
  initialOrders: OrderSummary[];
  profileId: string;
};

const POLL_MS = 5_000;

function mergeOrders(
  current: OrderSummary[],
  incoming: OrderSummary[],
): OrderSummary[] {
  const byId = new Map<string, OrderSummary>();
  for (const o of current) byId.set(o.id, o);
  for (const o of incoming) byId.set(o.id, o);
  return Array.from(byId.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export function OrdersListClient({ initialOrders, profileId }: Props) {
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders);
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());

  // Realtime subscription. Filter on created_by client-side because filtering
  // on a UUID column via Realtime is brittle; we patch row-by-row anyway.
  useEffect(() => {
    const supabase = (() => {
      try {
        return getBrowserClient();
      } catch (err) {
        console.warn("[orders] realtime disabled (no anon key?)", err);
        return null;
      }
    })();
    if (!supabase) return;
    const channel = supabase
      .channel(`orders:foreman:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `created_by=eq.${profileId}`,
        },
        (payload) => {
          const next = payload.new as Partial<OrderSummary> | null;
          if (!next || !next.id || !next.status) return;
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === next.id);
            if (idx === -1) {
              // unknown order — will be filled in by the next poll
              return prev;
            }
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              status: next.status as OrderStatus,
              total: next.total !== undefined ? Number(next.total) : copy[idx].total,
            };
            return copy;
          });
          setLastUpdated(Date.now());
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [profileId]);

  // 5 s polling fallback. Cheap GET, results merged client-side.
  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/orders/list", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { orders: OrderSummary[] };
        if (cancelled) return;
        setOrders((prev) => mergeOrders(prev, body.orders ?? []));
        setLastUpdated(Date.now());
      } catch (err) {
        console.warn("[orders] poll failed", err);
      }
    };
    const id = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const totalCount = useMemo(() => orders.length, [orders]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 pb-8 pt-4">
      <header className="flex items-center gap-2">
        <Link
          href="/foreman"
          className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 hover:border-zinc-400"
          aria-label={copyDe["nav.home"]}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-zinc-900">
            {copyDe["orders.title"]}
          </h1>
          <p className="text-xs text-zinc-500">
            {formatCopy(copyDe["orders.items"], { count: totalCount })}
          </p>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider text-zinc-400"
          title={new Date(lastUpdated).toISOString()}
        >
          Live
        </span>
      </header>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          {copyDe["orders.empty"]}
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li
              key={o.id}
              className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">
                  #{shortId(o.id)} · {o.total.toFixed(0)} {o.currency}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {new Date(o.created_at).toLocaleString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <StatusPill status={o.status} />
              {o.status === "pending" && (
                <p className="flex items-center gap-1 text-[11px] text-amber-700">
                  <Clock className="h-3 w-3" /> {copyDe["orders.waiting"]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
