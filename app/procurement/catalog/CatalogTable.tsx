"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { copyEn } from "@/lib/constants/copy.en";
import { categories, type CategoryKey } from "@/lib/constants/categories";

export type CatalogRow = {
  id: string;
  name: string;
  supplier_sku: string;
  product_group: string | null;
  unit: string;
  unit_price: number | null;
  currency: string;
  hazardous: boolean;
  status: "active" | "review";
  suppliers: { name: string };
};

type Props = {
  /** Server-filtered, server-paginated rows (≤ resultLimit). */
  products: CatalogRow[];
  /** Total active rows matching the current query (for "X of TOTAL"). */
  total: number;
  /** Current `?q=` from the URL — seeds the search box on mount. */
  query: string;
  /** Page-size cap (so we can hint "showing first N — search to narrow"). */
  resultLimit: number;
  // Server action passed down from the page (allowed in Next.js).
  updateProduct: (formData: FormData) => void | Promise<void>;
};

// A coloured dot per category — a small, decorative cue that never clashes
// with the status colours (those are larger pills). Falls back to neutral.
const GROUP_DOT: Record<string, string> = {
  fasteners: "bg-blue-500",
  electrical: "bg-violet-500",
  ppe: "bg-teal-500",
  tools: "bg-slate-500",
  covers_tape: "bg-amber-500",
  sealants: "bg-cyan-500",
  paint: "bg-pink-500",
  cleaning_chemicals: "bg-emerald-500",
  misc: "bg-stone-400",
};

const groupLabel = (g: string | null): string =>
  g && g in categories ? categories[g as CategoryKey].label_en : (g ?? "—");
const groupDot = (g: string | null): string =>
  (g && GROUP_DOT[g]) || "bg-zinc-300";

// Ghost field: reads as plain text in the card, reveals a border + ring on
// hover/focus so the whole row stays calm until you actually edit.
const GHOST =
  "rounded-md border border-transparent bg-transparent px-1.5 py-1 transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100";

const SEARCH_DEBOUNCE_MS = 280;

export function CatalogTable({
  products,
  total,
  query,
  resultLimit,
  updateProduct,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Local mirror of `?q=` so typing feels instant; we push to the URL on a
  // short debounce so the server re-queries without round-tripping every key.
  const [input, setInput] = useState(query);

  // Re-sync if the URL changes externally (back/forward, deep link).
  const externalQuery = query;
  const lastSynced = useRef(externalQuery);
  useEffect(() => {
    if (externalQuery !== lastSynced.current) {
      lastSynced.current = externalQuery;
      setInput(externalQuery);
    }
  }, [externalQuery]);

  // Debounced push to the URL → server re-renders with the new query.
  useEffect(() => {
    if (input === externalQuery) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const trimmed = input.trim();
      if (trimmed.length === 0) params.delete("q");
      else params.set("q", trimmed);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input, externalQuery, pathname, router, searchParams]);

  const shown = products.length;
  const hasQuery = externalQuery.length > 0;
  const showingFirst = !hasQuery && total > shown;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={copyEn["catalog.search"]}
            aria-label={copyEn["catalog.search"]}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-9 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput("")}
              aria-label={copyEn["catalog.search_clear"]}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-zinc-500 tabular-nums">
          {hasQuery
            ? `${shown.toLocaleString("en-CH")} / ${total.toLocaleString("en-CH")}`
            : `${total.toLocaleString("en-CH")}`}
        </span>
      </div>

      {/* Desktop column header — hidden on mobile, where each row is a card. */}
      <div className="hidden grid-cols-12 gap-2 px-4 pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 sm:grid">
        <span className="col-span-3">{copyEn["catalog.col_name"]}</span>
        <span className="col-span-2">{copyEn["catalog.col_supplier"]}</span>
        <span className="col-span-1">{copyEn["catalog.col_sku"]}</span>
        <span className="col-span-1">{copyEn["catalog.col_unit"]}</span>
        <span className="col-span-2">{copyEn["catalog.col_group"]}</span>
        <span className="col-span-2 text-right">{copyEn["catalog.col_price"]}</span>
        <span className="col-span-1" />
      </div>

      <div className="space-y-3 sm:space-y-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white sm:shadow-sm">
        {products.map((p) => (
          <form
            key={p.id}
            action={updateProduct}
            className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:border-t sm:border-zinc-100 sm:p-2 sm:px-4 sm:shadow-none sm:transition-colors sm:hover:bg-zinc-50/70 sm:hover:shadow-none"
          >
            <input type="hidden" name="id" value={p.id} />

            {/* Name + category dot */}
            <div className="flex items-center gap-2 sm:col-span-3">
              <span
                title={groupLabel(p.product_group)}
                className={`h-2.5 w-2.5 flex-none rounded-full ${groupDot(p.product_group)}`}
              />
              <input
                type="text"
                name="name"
                defaultValue={p.name}
                aria-label={copyEn["catalog.col_name"]}
                className={`min-w-0 flex-1 text-sm font-semibold text-zinc-900 sm:font-medium ${GHOST}`}
              />
            </div>

            {/* Meta line on mobile → three aligned cells on desktop via `contents`. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[1.125rem] text-xs text-zinc-500 sm:contents sm:mt-0 sm:pl-0">
              <span className="sm:col-span-2 sm:truncate sm:text-sm sm:text-zinc-600">
                {p.suppliers.name}
              </span>
              <span className="font-mono sm:col-span-1 sm:text-xs sm:text-zinc-500">
                {p.supplier_sku}
              </span>
              <span className="sm:col-span-1 sm:text-sm sm:text-zinc-600">
                {p.unit}
              </span>
            </div>

            {/* Group (editable) */}
            <label className="mt-2 flex items-center gap-2 sm:col-span-2 sm:mt-0">
              <span className="w-12 shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-400 sm:hidden">
                {copyEn["catalog.col_group"]}
              </span>
              <input
                type="text"
                name="product_group"
                defaultValue={p.product_group ?? ""}
                placeholder="—"
                aria-label={copyEn["catalog.col_group"]}
                className={`min-w-0 flex-1 text-sm text-zinc-700 sm:w-full ${GHOST}`}
              />
            </label>

            {/* Price (editable) */}
            <label className="mt-2 flex items-center gap-2 sm:col-span-2 sm:mt-0 sm:justify-end">
              <span className="w-12 shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-400 sm:hidden">
                {copyEn["catalog.col_price"]}
              </span>
              <input
                type="number"
                name="unit_price"
                defaultValue={p.unit_price ?? ""}
                step="0.01"
                min="0"
                aria-label={copyEn["catalog.col_price"]}
                className={`min-w-0 flex-1 text-right text-sm tabular-nums text-zinc-900 sm:w-20 sm:flex-none ${GHOST}`}
              />
              <span className="text-xs text-zinc-400">{p.currency}</span>
            </label>

            {/* Save */}
            <div className="mt-3 sm:col-span-1 sm:mt-0 sm:justify-self-end">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover sm:w-auto sm:px-2.5 sm:py-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span className="sm:hidden">{copyEn["catalog.col_save"]}</span>
              </button>
            </div>
          </form>
        ))}

        {products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-500 sm:rounded-none sm:border-0 sm:border-t sm:border-zinc-100">
            {hasQuery
              ? `${copyEn["catalog.search_empty"]} “${externalQuery}”.`
              : copyEn["catalog.empty"]}
          </p>
        )}
      </div>

      {showingFirst && (
        <p className="px-1 text-xs text-zinc-400">
          Showing first {resultLimit.toLocaleString("en-CH")} of{" "}
          {total.toLocaleString("en-CH")} — type to narrow.
        </p>
      )}
    </div>
  );
}
