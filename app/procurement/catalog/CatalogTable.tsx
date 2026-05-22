"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { copyEn } from "@/lib/constants/copy.en";

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
  products: CatalogRow[];
  limit: number;
  // Server action passed down from the page (allowed in Next.js).
  updateProduct: (formData: FormData) => void | Promise<void>;
};

export function CatalogTable({ products, limit, updateProduct }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.supplier_sku, p.suppliers?.name, p.product_group, p.unit]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [products, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copyEn["catalog.search"]}
            aria-label={copyEn["catalog.search"]}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-9 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={copyEn["catalog.search_clear"]}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium text-zinc-500">
          {query ? `${filtered.length} / ${products.length}` : `${products.length}`}
        </span>
      </div>

      {/* Desktop column header — hidden on mobile, where each row is a card. */}
      <div className="hidden grid-cols-12 gap-2 rounded-t-2xl border border-b-0 border-zinc-200 bg-zinc-50 px-4 py-2 text-xs uppercase tracking-wide text-zinc-500 sm:grid">
        <span className="col-span-3">{copyEn["catalog.col_name"]}</span>
        <span className="col-span-2">{copyEn["catalog.col_supplier"]}</span>
        <span className="col-span-1">{copyEn["catalog.col_sku"]}</span>
        <span className="col-span-2">{copyEn["catalog.col_group"]}</span>
        <span className="col-span-1">{copyEn["catalog.col_unit"]}</span>
        <span className="col-span-2 text-right">{copyEn["catalog.col_price"]}</span>
        <span className="col-span-1" />
      </div>

      <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-zinc-100 sm:rounded-b-2xl sm:border sm:border-zinc-200 sm:bg-white sm:shadow-sm">
        {filtered.map((p) => (
          <form
            key={p.id}
            action={updateProduct}
            className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 sm:space-y-0 sm:rounded-none sm:border-0 sm:p-2 sm:px-4 sm:shadow-none"
          >
            <input type="hidden" name="id" value={p.id} />
            <input
              type="text"
              name="name"
              defaultValue={p.name}
              aria-label={copyEn["catalog.col_name"]}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-medium sm:col-span-3 sm:py-1 sm:font-normal"
            />
            {/* Meta: a wrapped line on mobile; on sm+ `contents` lets the three
                spans drop into the parent grid as their own cells. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 sm:contents">
              <span className="sm:col-span-2 sm:text-sm sm:text-zinc-600">
                {p.suppliers.name}
              </span>
              <span className="font-mono sm:col-span-1 sm:text-xs sm:text-zinc-500">
                {p.supplier_sku}
              </span>
              <span className="sm:col-span-1 sm:text-sm sm:text-zinc-600">
                {p.unit}
              </span>
            </div>
            <input
              type="text"
              name="product_group"
              defaultValue={p.product_group ?? ""}
              aria-label={copyEn["catalog.col_group"]}
              placeholder={copyEn["catalog.col_group"]}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm sm:col-span-2 sm:py-1"
            />
            <div className="flex items-center gap-1 sm:col-span-2 sm:justify-end">
              <input
                type="number"
                name="unit_price"
                defaultValue={p.unit_price ?? ""}
                step="0.01"
                min="0"
                aria-label={copyEn["catalog.col_price"]}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-right text-sm sm:w-24 sm:py-1"
              />
              <span className="text-xs text-zinc-500">{p.currency}</span>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-hover sm:col-span-1 sm:w-auto sm:justify-self-end sm:py-1"
            >
              {copyEn["catalog.col_save"]}
            </button>
          </form>
        ))}

        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500 sm:rounded-none sm:border-0 sm:border-t sm:border-solid sm:border-zinc-100">
            {copyEn["catalog.search_empty"]} “{query}”.
          </p>
        )}
        {!query && products.length === limit && (
          <p className="px-4 py-2 text-xs text-zinc-500">
            Showing first {limit} active products on this project.
          </p>
        )}
      </div>
    </div>
  );
}
