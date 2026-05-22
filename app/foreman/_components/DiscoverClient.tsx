"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Search, ShieldAlert } from "lucide-react";

import { copyDe } from "@/lib/constants/copy.de";
import { isABlockedTerm } from "@/lib/constants/blocklist";
import {
  type CategoryKey,
  categories,
} from "@/lib/constants/categories";
import {
  discoverResponseSchema,
  type DiscoverItem,
} from "@/lib/schema";

import { CategoryGrid } from "./CategoryGrid";
import { BottomNavBar } from "./BottomNavBar";
import { CartSheet } from "./CartSheet";
import { AssistantSheet } from "./AssistantSheet";
import { VoiceSearch } from "./VoiceSearch";

type CartLine = { product_id: string; qty: number };

type CatalogLite = {
  product_id: string;
  supplier_sku: string;
  name: string;
  unit: string;
  product_group: string | null;
  unit_price: number;
};

type Props = {
  projectId: string;
  catalog: CatalogLite[];
};

const CART_STORAGE_KEY = "siteorder.cart.v1";

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

async function submitToServer(items: CartLine[]) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`POST /api/orders failed: ${res.status}`);
  return res.json();
}

type DiscoverState =
  | { kind: "idle" }
  | { kind: "blocked"; message: string }
  | { kind: "searching" }
  | { kind: "results"; items: DiscoverItem[]; canned: boolean }
  | { kind: "empty" }
  | { kind: "error" };

export function DiscoverClient({ projectId, catalog }: Props) {
  const router = useRouter();
  // Initial state matches SSR ([]). After the first client paint reproduces
  // the server HTML, the mount effect hydrates from localStorage.
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(
    null,
  );
  const [task, setTask] = useState("");
  const [state, setState] = useState<DiscoverState>({ kind: "idle" });
  const [submitState, setSubmitState] = useState<
    "idle" | "sending" | "queued" | "error"
  >("idle");

  // One-shot hydration of cart from localStorage after first paint.
  // setState-in-effect is intentional — this is the documented pattern for
  // rehydrating browser-only persistent state.
  useEffect(() => {
    const persisted = loadCart();
    if (persisted.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(persisted);
    }
  }, []);

  useEffect(() => {
    persistCart(cart);
  }, [cart]);

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return catalog
      .filter((p) => p.product_group === selectedCategory)
      .slice(0, 20);
  }, [catalog, selectedCategory]);


  function addToCart(product_id: string, qty = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product_id === product_id);
      if (idx === -1) return [...prev, { product_id, qty }];
      const next = [...prev];
      next[idx] = { product_id, qty: next[idx].qty + qty };
      return next;
    });
  }

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

  function removeFromCart(product_id: string) {
    setCart((prev) => prev.filter((l) => l.product_id !== product_id));
  }

  const runSearch = useCallback(
    async (rawTask: string) => {
      const t = rawTask.trim();
      if (!t) return;

      // Client-side A-material block first — plan §Phase 7: never hit the API.
      if (isABlockedTerm(t)) {
        setState({ kind: "blocked", message: copyDe["discover.blocked.body"] });
        return;
      }

      setState({ kind: "searching" });
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: t, project_id: projectId }),
        });
        const body = await res.json();
        if (body?.redirect === true) {
          setState({
            kind: "blocked",
            message:
              typeof body.message === "string"
                ? body.message
                : copyDe["discover.blocked.body"],
          });
          return;
        }
        const parsed = discoverResponseSchema.safeParse(body);
        if (!parsed.success) {
          console.warn("[discover] response failed schema", parsed.error);
          setState({ kind: "error" });
          return;
        }
        if (parsed.data.items.length === 0) {
          setState({ kind: "empty" });
          return;
        }
        setState({
          kind: "results",
          items: parsed.data.items,
          canned: parsed.data.canned,
        });
      } catch (err) {
        console.warn("[discover] fetch failed", err);
        setState({ kind: "error" });
      }
    },
    [projectId],
  );

  const onSubmit = useCallback(async () => {
    if (cart.length === 0) return;
    setSubmitState("sending");
    try {
      await submitToServer(cart);
      setCart([]);
      setSubmitState("idle");
      router.push("/foreman/orders");
    } catch (err) {
      console.error("[discover] submit failed", err);
      setSubmitState("error");
    }
  }, [cart, router]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-28 pt-4">
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
            {copyDe["discover.title"]}
          </h1>
          <p className="text-xs text-zinc-500">{copyDe["discover.subtitle"]}</p>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(task);
        }}
        className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus-within:border-zinc-400"
      >
        <Search className="h-4 w-4 text-zinc-400" />
        <input
          type="search"
          inputMode="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={copyDe["discover.search_placeholder"]}
          className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        <VoiceSearch
          onTranscript={(transcript) => {
            setTask(transcript);
            void runSearch(transcript);
          }}
          disabled={state.kind === "searching"}
        />
        <button
          type="submit"
          disabled={!task.trim() || state.kind === "searching"}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {state.kind === "searching"
            ? copyDe["discover.searching"]
            : copyDe["discover.search_submit"]}
        </button>
      </form>

      {state.kind === "blocked" && (
        <section
          className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"
          role="alert"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4" />
            {copyDe["discover.blocked.title"]}
          </p>
          <p className="text-sm leading-snug">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setTask("");
              setState({ kind: "idle" });
            }}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-50"
          >
            {copyDe["discover.blocked.back"]}
          </button>
        </section>
      )}

      {state.kind !== "blocked" && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700">
              {copyDe["discover.categories"]}
            </h2>
            <CategoryGrid
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </section>

          {/* Search results take precedence over category browse */}
          {state.kind === "searching" && (
            <p className="text-sm text-zinc-500">{copyDe["discover.searching"]}</p>
          )}

          {state.kind === "empty" && (
            <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
              {copyDe["discover.empty"]}
            </p>
          )}

          {state.kind === "error" && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {copyDe["cart.error"]}
            </p>
          )}

          {state.kind === "results" && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700">
                  {copyDe["discover.results"]}
                </h2>
                {state.canned && (
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                    {copyDe["discover.canned_hint"]}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {state.items.map((it) => {
                  const inCart =
                    cart.find((c) => c.product_id === it.product_id)?.qty ?? 0;
                  return (
                    <li
                      key={it.product_id}
                      className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900">
                            {it.name}
                          </p>
                          <p className="text-xs text-zinc-500">{it.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(it.product_id, 1)}
                          aria-label={copyDe["discover.add_to_cart"]}
                          className="flex h-10 items-center gap-1 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white"
                        >
                          <Plus className="h-4 w-4" />
                          {inCart > 0 ? `${inCart}` : copyDe["discover.add_to_cart"]}
                        </button>
                      </div>
                      <p className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs italic text-zinc-700">
                        {it.reason}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Category browse appears when no active search */}
          {state.kind === "idle" && selectedCategory && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-700">
                {categories[selectedCategory].label_de}
              </h2>
              {categoryItems.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
                  {copyDe["discover.empty"]}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  {categoryItems.map((p) => {
                    const inCart =
                      cart.find((c) => c.product_id === p.product_id)?.qty ?? 0;
                    return (
                      <li
                        key={p.product_id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">
                            {p.name}
                          </p>
                          <p className="text-xs text-zinc-500">{p.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(p.product_id, 1)}
                          aria-label={copyDe["discover.add_to_cart"]}
                          className="flex h-10 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white"
                        >
                          {inCart > 0 ? inCart : <Plus className="h-4 w-4" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <div className="flex-1" />

      <BottomNavBar
        currentPath="/foreman/discover"
        cartCount={cart.reduce((s, l) => s + l.qty, 0)}
        onCartTap={() => setCartOpen(true)}
        onAssistantTap={() => setAssistantOpen(true)}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        productById={
          new Map(
            catalog.map((p) => [
              p.product_id,
              {
                id: p.product_id,
                supplier_sku: p.supplier_sku,
                name: p.name,
                unit: p.unit,
                unit_price: p.unit_price,
                product_group: p.product_group,
                hazardous: false,
              },
            ]),
          )
        }
        state={submitState}
        online={true}
        onChangeQty={setQty}
        onSubmit={() => {
          setCartOpen(false);
          onSubmit();
        }}
      />

      <AssistantSheet
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        projectId={projectId}
        cart={cart}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
      />
    </div>
  );
}
