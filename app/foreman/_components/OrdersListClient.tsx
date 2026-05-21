"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock, RotateCcw, X } from "lucide-react";

import { copyDe, formatCopy } from "@/lib/constants/copy.de";
import { getBrowserClient } from "@/lib/supabase/browser";

import { StatusPill, type OrderStatus } from "./StatusPill";
import { BottomNavBar } from "./BottomNavBar";

const CART_STORAGE_KEY = "siteorder.cart.v1";

function readCartCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw) as Array<{ qty?: number }>;
    return arr.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  } catch {
    return 0;
  }
}

type OrderLineSummary = {
  qty: number;
  product_id: string;
  line_status?: "approved" | "rejected" | null;
  decline_reason?: string | null;
  suggested_product_id?: string | null;
};

type OrderSummary = {
  id: string;
  status: OrderStatus;
  total: number;
  currency: string;
  created_at: string;
  items: OrderLineSummary[];
};

type Props = {
  initialOrders: OrderSummary[];
  profileId: string;
};

const POLL_MS = 3_000;

// In-flight orders the foreman is tracking. Everything else (delivered /
// rejected) is "Verlauf" (history) and is tucked away by default so the
// list doesn't dump every past order at once.
const ACTIVE_STATUSES: OrderStatus[] = [
  "draft",
  "pending",
  "approved",
  "ordered",
];

// Foreman can hide an order from the active view ("ausblenden"). Hidden ids
// live in localStorage (a per-device view preference) — the order is never
// deleted, it just moves to Verlauf, so procurement + analytics are untouched
// and the foreman can restore it.
const DISMISS_KEY = "siteorder.orders.dismissed.v1";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

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
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartCount(readCartCount());
    const id = setInterval(() => setCartCount(readCartCount()), 3000);
    return () => clearInterval(id);
  }, []);
  const [orders, setOrders] = useState<OrderSummary[]>(initialOrders);
  // 0 on first render (SSR + first client paint match); the mount effect
  // below stamps it with Date.now() once we're past hydration.
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [view, setView] = useState<"active" | "history">("active");
  // Starts empty so SSR + first client paint match; loaded from localStorage
  // on mount.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setLastUpdated(Date.now());
    setDismissed(loadDismissed());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

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

  // 3 s polling fallback against GET /api/orders/list (now merged). If the
  // endpoint ever 404s we degrade gracefully and rely on Realtime alone.
  useEffect(() => {
    let cancelled = false;
    let endpointMissing = false;
    const fetchOnce = async () => {
      if (endpointMissing) return;
      try {
        const res = await fetch("/api/orders/list", { cache: "no-store" });
        if (res.status === 404) {
          endpointMissing = true;
          return;
        }
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

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  }

  function restore(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistDismissed(next);
      return next;
    });
  }

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) => ACTIVE_STATUSES.includes(o.status) && !dismissed.has(o.id),
      ),
    [orders, dismissed],
  );
  const historyOrders = useMemo(
    () =>
      orders.filter(
        (o) => !ACTIVE_STATUSES.includes(o.status) || dismissed.has(o.id),
      ),
    [orders, dismissed],
  );
  const shown = view === "active" ? activeOrders : historyOrders;

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
            {formatCopy(copyDe["orders.items"], { count: shown.length })}
          </p>
        </div>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          {lastUpdated
            ? `Live · ${new Date(lastUpdated).toLocaleTimeString("de-CH")}`
            : "Live"}
        </span>
      </header>

      <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setView("active")}
          className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${
            view === "active"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Aktuell ({activeOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${
            view === "history"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500"
          }`}
        >
          Verlauf ({historyOrders.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
          {view === "active"
            ? "Keine offenen Bestellungen — alles erledigt."
            : "Noch kein Verlauf."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((o) => {
            const isDismissed = dismissed.has(o.id);
            const declined = o.items.filter(
              (it) => it.line_status === "rejected",
            ).length;
            const hasSuggestion = o.items.some(
              (it) =>
                it.line_status === "rejected" && it.suggested_product_id,
            );
            return (
              <li
                key={o.id}
                className="relative rounded-2xl border border-zinc-200 bg-white shadow-sm transition-colors hover:border-zinc-300"
              >
                <Link
                  href={`/foreman/orders/${o.id}`}
                  className="block space-y-2 p-3 pr-9"
                  aria-label={`${copyDe["order_detail.title"]} #${shortId(o.id)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900">
                        #{shortId(o.id)} · {o.total.toFixed(0)} {o.currency}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {formatCopy(copyDe["orders.items"], {
                          count: o.items.length,
                        })}
                      </p>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {new Date(o.created_at).toLocaleString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={o.status} />
                    {declined > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        {formatCopy(copyDe["orders.lines_declined"], {
                          declined,
                          total: o.items.length,
                        })}
                      </span>
                    )}
                    {hasSuggestion && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        {copyDe["orders.has_suggestion"]}
                      </span>
                    )}
                  </div>
                  {o.status === "pending" && (
                    <p className="flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="h-3 w-3" /> {copyDe["orders.waiting"]}
                    </p>
                  )}
                </Link>
                <ChevronRight className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-300" />
                {view === "active" ? (
                  <button
                    type="button"
                    onClick={() => dismiss(o.id)}
                    aria-label="Ausblenden"
                    title="Ausblenden"
                    className="absolute bottom-2 right-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : isDismissed ? (
                  <button
                    type="button"
                    onClick={() => restore(o.id)}
                    aria-label="Wieder anzeigen"
                    title="Wieder anzeigen"
                    className="absolute bottom-2 right-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <BottomNavBar
        currentPath="/foreman/orders"
        cartCount={cartCount}
        onCartTap={() => router.push("/foreman?cart=1")}
        onAssistantTap={() => router.push("/foreman?ai=1")}
      />
      <div className="h-20" aria-hidden />
    </div>
  );
}
