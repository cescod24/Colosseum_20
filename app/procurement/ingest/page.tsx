"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categories, type CategoryKey } from "@/lib/constants/categories";
import { isReviewRow, type IngestedProduct } from "@/lib/schema";

type IngestResult = {
  mode: "csv" | "pdf";
  supplier_name: string;
  rows: IngestedProduct[];
  summary: { total: number; active: number; review: number };
  persisted: { persisted: number; review: number } | null;
};

function badgeFor(row: IngestedProduct) {
  if (isReviewRow(row)) return { label: "Review", tone: "warning" as const };
  return { label: "Active", tone: "success" as const };
}

function categoryLabel(key: string | null | undefined): string {
  if (!key) return "—";
  if (key in categories) {
    return categories[key as CategoryKey].label_en;
  }
  return key;
}

function formatPrice(v: number | null) {
  if (v === null) return "—";
  return `${v.toFixed(2)} CHF`;
}

export default function IngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activatedSkus, setActivatedSkus] = useState<Set<string>>(new Set());

  const reviewRows = useMemo(
    () => (result ? result.rows.filter(isReviewRow) : []),
    [result],
  );

  const activeRows = useMemo(
    () => (result ? result.rows.filter((r) => !isReviewRow(r)) : []),
    [result],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please pick a CSV or PDF file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setActivatedSkus(new Set());
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (supplierName.trim()) fd.append("supplier_name", supplierName.trim());
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
      } else {
        setResult(body as IngestResult);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function activateRow(sku: string) {
    // No-DB local demo: just toggle the UI badge. The route handler below
    // (Phase 5/6 wiring) would PATCH /api/products/[sku]/activate.
    setActivatedSkus((prev) => new Set([...prev, sku]));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Procurement — Catalog ingestion
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Upload supplier catalog</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← role picker
          </Link>
        </div>
        <p className="text-sm text-zinc-600">
          CSV / Excel <span className="text-zinc-400">or</span> contract PDF.
          PDFs go through Anthropic; rows with missing price, missing unit,
          or confidence &lt; 0.7 land in <em>review</em> for you to confirm.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-zinc-200"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-zinc-700">File</span>
            <input
              type="file"
              accept=".csv,.tsv,.pdf,application/pdf,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-zinc-200"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-zinc-700">
              Supplier name (optional)
            </span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. ACME Bauzulieferung AG"
              className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy || !file}
            className="rounded-xl bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {busy ? "Processing…" : "Process file"}
          </button>
          {file && (
            <span className="text-xs text-zinc-500">
              Selected: <code className="font-mono">{file.name}</code> ·{" "}
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
              {result.mode.toUpperCase()}
            </span>
            <span className="text-sm">
              <span className="font-medium">Supplier:</span> {result.supplier_name}
            </span>
            <span className="text-sm text-zinc-500">
              {result.summary.total} rows · {result.summary.active} active ·{" "}
              {result.summary.review} review
            </span>
            <span className="ml-auto text-xs text-zinc-500">
              {result.persisted
                ? `Saved to DB: ${result.persisted.persisted} (review: ${result.persisted.review})`
                : "DB not connected — preview only"}
            </span>
          </div>

          {reviewRows.length > 0 && (
            <RowsTable
              title={`Needs review (${reviewRows.length})`}
              rows={reviewRows}
              activated={activatedSkus}
              onActivate={activateRow}
              highlight
            />
          )}

          {activeRows.length > 0 && (
            <RowsTable
              title={`Auto-activated (${activeRows.length})`}
              rows={activeRows}
              activated={activatedSkus}
              onActivate={activateRow}
            />
          )}
        </section>
      )}
    </main>
  );
}

function RowsTable({
  title,
  rows,
  activated,
  onActivate,
  highlight,
}: {
  title: string;
  rows: IngestedProduct[];
  activated: Set<string>;
  onActivate: (sku: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white ring-1 ${
        highlight ? "ring-amber-200" : "ring-zinc-200"
      }`}
    >
      <header
        className={`flex items-center justify-between px-5 py-3 text-sm font-semibold ${
          highlight ? "bg-amber-50 text-amber-900" : "bg-zinc-50 text-zinc-700"
        }`}
      >
        <span>{title}</span>
      </header>
      <table className="w-full text-left text-sm">
        <thead className="border-y border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-5 py-2 font-medium">SKU</th>
            <th className="px-5 py-2 font-medium">Name</th>
            <th className="px-5 py-2 font-medium">Category</th>
            <th className="px-5 py-2 font-medium">Unit</th>
            <th className="px-5 py-2 font-medium">Price</th>
            <th className="px-5 py-2 font-medium">Confidence</th>
            <th className="px-5 py-2 font-medium">Status</th>
            <th className="px-5 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = badgeFor(row);
            const isActivated = activated.has(row.supplier_sku);
            return (
              <tr key={row.supplier_sku} className="border-t border-zinc-100">
                <td className="px-5 py-3 font-mono text-xs">{row.supplier_sku}</td>
                <td className="px-5 py-3">
                  {row.name}
                  {row.hazardous && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                      hazardous
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-600">
                  {categoryLabel(row.product_group)}
                </td>
                <td className="px-5 py-3 text-zinc-600">{row.unit ?? "—"}</td>
                <td className="px-5 py-3 text-zinc-600">
                  {formatPrice(row.unit_price)}
                </td>
                <td className="px-5 py-3 text-zinc-600">
                  {(row.confidence * 100).toFixed(0)}%
                </td>
                <td className="px-5 py-3">
                  {isActivated ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Activated
                    </span>
                  ) : badge.tone === "warning" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      Review
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {!isActivated && (
                    <button
                      type="button"
                      onClick={() => onActivate(row.supplier_sku)}
                      className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-zinc-500"
                    >
                      Bestätigen & aktivieren
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
