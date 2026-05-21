import Link from "next/link";

// Placeholder — the real procurement queue lands in Phase 5 (slice B).
// Slice C surfaces its working pages from here so reviewers can find them.

export default function ProcurementQueuePlaceholder() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Procurement
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Workbench</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← role picker
          </Link>
        </div>
        <p className="text-sm text-zinc-600">
          The approval queue (Phase 5, slice B) is not built yet. In the
          meantime, the slice-C pages below already work end-to-end.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/procurement/ingest"
          className="block space-y-2 rounded-2xl bg-white p-5 ring-1 ring-zinc-200 hover:ring-zinc-400"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Phase 6 — Slice C
          </p>
          <p className="text-base font-semibold">Catalog ingestion</p>
          <p className="text-sm text-zinc-600">
            Upload a CSV or contract PDF. Rows with null price, null unit, or
            low confidence land in <em>review</em>.
          </p>
        </Link>
        <Link
          href="/procurement/discover-test"
          className="block space-y-2 rounded-2xl bg-white p-5 ring-1 ring-zinc-200 hover:ring-zinc-400"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Phase 7 backend — Slice C
          </p>
          <p className="text-base font-semibold">Discover smoke test</p>
          <p className="text-sm text-zinc-600">
            Test <code>POST /api/discover</code> — task → ranked items, with
            A-material redirect.
          </p>
        </Link>
        <div className="block space-y-2 rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Phase 5 — Slice B
          </p>
          <p className="text-base font-semibold text-zinc-500">
            Approval queue
          </p>
          <p className="text-sm text-zinc-500">
            Not built yet.
          </p>
        </div>
      </section>
    </main>
  );
}
