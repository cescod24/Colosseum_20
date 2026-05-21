"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ClipboardList, LogOut, Search } from "lucide-react";

import { copyDe, formatCopy } from "@/lib/constants/copy.de";
import type {
  CatalogProduct,
  ForemanLastOrder,
  MaterialSet,
  MostOrderedRow,
} from "@/lib/data/foreman";

import { ExplainerBanner } from "./ExplainerBanner";
import { Stepper } from "./Stepper";
import { ChipRow } from "./ChipRow";
import { KitTile } from "./KitTile";
import { CartBar } from "./CartBar";
import { OfflineToggle } from "./OfflineToggle";

const CART_STORAGE_KEY = "siteorder.cart.v1";
const QUEUE_STORAGE_KEY = "siteorder.cart.queue.v1";

type CartLine = { product_id: string; qty: number };
type QueuedSubmission = { id: string; items: CartLine[]; created_at: string };

type Props = {
  greeting: string;
  catalog: CatalogProduct[];
  lastOrder: ForemanLastOrder | null;
  sets: MaterialSet[];
  mostOrdered: MostOrderedRow[];
};

function loadCart(): CartLine[] {
  if (typeof window === "undefined") return [];
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

function loadQueue(): QueuedSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedSubmission[];
  } catch {
    return [];
  }
}

function persistQueue(queue: QueuedSubmission[]) {
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

async function submitToServer(items: CartLine[]) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/orders failed: ${res.status} ${text}`);
  }
  return res.json();
}

export function ForemanHomeClient({
  greeting,
  catalog,
  lastOrder,
  sets,
  mostOrdered,
}: Props) {
  const router = useRouter();
  const productById = useMemo(() => {
    const m = new Map<string, CatalogProduct>();
    for (const p of catalog) m.set(p.id, p);
    return m;
  }, [catalog]);

  // All three states start with SSR-matching defaults (empty / true / 0) so
  // the first client paint reproduces the server HTML byte-for-byte. We then
  // sync from localStorage + navigator in a single mount-time effect.
  // The setState-in-effect lint rule fires here, but this is precisely the
  // pattern React docs prescribe for "hydrate from browser-only storage."
  const [cart, setCart] = useState<CartLine[]>([]);
  const [forcedOffline, setForcedOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [submitState, setSubmitState] = useState<
    "idle" | "sending" | "queued" | "error"
  >("idle");
  const [queueLen, setQueueLen] = useState<number>(0);

  // One-shot hydration of cart + queue length + navigator.onLine from the
  // browser, after the first client render has reproduced the SSR HTML.
  // setState-in-effect is intentional here — this is React's documented
  // pattern for "rehydrate from browser-only storage." It runs exactly once
  // (no dep changes), so it can't cascade.
  useEffect(() => {
    const persisted = loadCart();
    let nextCart: CartLine[] | null = null;
    if (persisted.length) {
      nextCart = persisted;
    } else if (lastOrder) {
      nextCart = lastOrder.lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
      }));
    }
    const qLen = loadQueue().length;
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextCart) setCart(nextCart);
    if (qLen > 0) setQueueLen(qLen);
    if (offline) setBrowserOnline(false);
  }, [lastOrder]);

  // Wire up the online/offline change listeners (these only fire on transitions
  // after mount — setState in the callbacks is fine, not setState-in-effect).
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    persistCart(cart);
  }, [cart]);

  const online = browserOnline && !forcedOffline;

  // Flush the offline queue whenever we come back online.
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      const queue = loadQueue();
      if (!queue.length) return;
      const remaining: QueuedSubmission[] = [];
      for (const q of queue) {
        try {
          await submitToServer(q.items);
        } catch (err) {
          console.warn("[foreman] queue flush failed", err);
          remaining.push(q);
        }
      }
      if (cancelled) return;
      persistQueue(remaining);
      setQueueLen(remaining.length);
      if (remaining.length === 0) {
        setSubmitState("idle");
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, router]);

  function setQty(product_id: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.product_id !== product_id);
      const idx = prev.findIndex((l) => l.product_id === product_id);
      if (idx === -1) return [...prev, { product_id, qty }];
      const next = [...prev];
      next[idx] = { product_id, qty };
      return next;
    });
  }

  function addToCart(product_id: string, qty: number) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product_id === product_id);
      if (idx === -1) return [...prev, { product_id, qty }];
      const next = [...prev];
      next[idx] = { product_id, qty: next[idx].qty + qty };
      return next;
    });
  }

  function loadKit(set: MaterialSet) {
    setCart((prev) => {
      const next = [...prev];
      for (const it of set.items) {
        const idx = next.findIndex((l) => l.product_id === it.product.id);
        if (idx === -1) {
          next.push({ product_id: it.product.id, qty: it.default_qty });
        } else {
          next[idx] = { product_id: it.product.id, qty: it.default_qty };
        }
      }
      return next;
    });
  }

  const total = useMemo(() => {
    let sum = 0;
    for (const l of cart) {
      const p = productById.get(l.product_id);
      if (!p) continue;
      sum += p.unit_price * l.qty;
    }
    return sum;
  }, [cart, productById]);

  const onSubmit = useCallback(async () => {
    if (cart.length === 0) return;
    if (!online) {
      const queue = loadQueue();
      queue.push({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `q-${Date.now()}`,
        items: cart,
        created_at: new Date().toISOString(),
      });
      persistQueue(queue);
      setQueueLen(queue.length);
      setSubmitState("queued");
      setCart([]);
      return;
    }
    setSubmitState("sending");
    try {
      await submitToServer(cart);
      setCart([]);
      setSubmitState("idle");
      router.push("/foreman/orders");
    } catch (err) {
      console.error("[foreman] submit failed", err);
      setSubmitState("error");
    }
  }, [cart, online, router]);


  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-28 pt-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {copyDe["home.greeting"]}
          </p>
          <p className="text-sm text-zinc-600">{greeting}</p>
        </div>
        <div className="flex items-center gap-2">
          <OfflineToggle
            forcedOffline={forcedOffline}
            onToggle={setForcedOffline}
          />
          <Link
            href="/foreman/orders"
            className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 hover:border-zinc-400"
            aria-label={copyDe["nav.orders"]}
          >
            <ClipboardList className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 hover:border-zinc-400"
            aria-label={copyDe["nav.role_switch"]}
          >
            <LogOut className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <ExplainerBanner />

      {queueLen > 0 && online && submitState !== "sending" && (
        <p className="rounded-md bg-emerald-50 px-3 py-1 text-xs text-emerald-900">
          {copyDe["cart.queued"]}
        </p>
      )}

      {/* Last order */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-zinc-900">
          {copyDe["home.last_order"]}
        </h2>
        {!lastOrder ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            {copyDe["home.last_order_empty"]}
          </p>
        ) : (
          <ul className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
            {lastOrder.lines.map((line) => {
              const inCart =
                cart.find((c) => c.product_id === line.product_id)?.qty ?? 0;
              return (
                <li
                  key={line.product_id}
                  className="flex items-center justify-between gap-2 rounded-xl p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {line.product.name}
                    </p>
                    <p className="text-xs text-zinc-500">{line.product.unit}</p>
                    <div className="mt-1">
                      <ChipRow
                        unit={line.product.unit}
                        selected={inCart}
                        onSelect={(n) => setQty(line.product_id, n)}
                      />
                    </div>
                  </div>
                  <Stepper
                    value={inCart}
                    onChange={(n) => setQty(line.product_id, n)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Sets */}
      {sets.length > 0 && (
        <section className="space-y-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              {copyDe["home.sets"]}
            </h2>
            <p className="text-xs text-zinc-500">
              {copyDe["home.sets_subtitle"]}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sets.map((set) => (
              <KitTile
                key={set.id}
                name={set.name}
                itemCount={set.items.length}
                onTap={() => loadKit(set)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Most ordered */}
      {mostOrdered.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-zinc-900">
            {copyDe["home.most_ordered"]}
          </h2>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {mostOrdered.map((row) => {
              const inCart =
                cart.find((c) => c.product_id === row.product.id)?.qty ?? 0;
              return (
                <li
                  key={row.product.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {row.product.name}
                    </p>
                    <p className="text-xs text-zinc-500">{row.product.unit}</p>
                  </div>
                  {inCart > 0 ? (
                    <Stepper
                      value={inCart}
                      onChange={(n) => setQty(row.product.id, n)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(row.product.id, 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white"
                      aria-label={formatCopy(copyDe["kits.added"], { name: row.product.name })}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link
        href="/foreman/discover"
        className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
      >
        <Search className="h-4 w-4" />
        {copyDe["discover.search_placeholder"]}
        <ChevronRight className="ml-auto h-4 w-4" />
      </Link>

      <div className="flex-1" />

      <CartBar
        total={total}
        itemCount={cart.reduce((s, l) => s + l.qty, 0)}
        state={submitState}
        online={online}
        onSubmit={onSubmit}
      />
    </div>
  );
}
