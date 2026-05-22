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

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_name"]}</th>
              <th className="px-4 py-2 font-medium">
                {copyEn["catalog.col_supplier"]}
              </th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_sku"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_group"]}</th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_unit"]}</th>
              <th className="px-4 py-2 text-right font-medium">
                {copyEn["catalog.col_price"]}
              </th>
              <th className="px-4 py-2 font-medium">{copyEn["catalog.col_save"]}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td colSpan={7} className="px-4 py-2">
                  <form
                    action={updateProduct}
                    className="grid grid-cols-12 items-center gap-2"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      type="text"
                      name="name"
                      defaultValue={p.name}
                      aria-label={copyEn["catalog.col_name"]}
                      className="col-span-3 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <span className="col-span-2 text-zinc-600">
                      {p.suppliers.name}
                    </span>
                    <span className="col-span-1 font-mono text-xs text-zinc-500">
                      {p.supplier_sku}
                    </span>
                    <input
                      type="text"
                      name="product_group"
                      defaultValue={p.product_group ?? ""}
                      aria-label={copyEn["catalog.col_group"]}
                      className="col-span-2 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <span className="col-span-1 text-zinc-600">{p.unit}</span>
                    <div className="col-span-2 flex items-center gap-1">
                      <input
                        type="number"
                        name="unit_price"
                        defaultValue={p.unit_price ?? ""}
                        step="0.01"
                        min="0"
                        aria-label={copyEn["catalog.col_price"]}
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm"
                      />
                      <span className="text-xs text-zinc-500">{p.currency}</span>
                    </div>
                    <button
                      type="submit"
                      className="col-span-1 justify-self-end rounded-md bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-hover"
                    >
                      {copyEn["catalog.col_save"]}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="border-t border-zinc-100 px-4 py-8 text-center text-sm text-zinc-500">
            {copyEn["catalog.search_empty"]} “{query}”.
          </p>
        )}
        {!query && products.length === limit && (
          <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
            Showing first {limit} active products on this project.
          </p>
        )}
      </div>
    </div>
  );
}
