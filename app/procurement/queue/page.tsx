import Link from "next/link";

// Placeholder — the real procurement queue lands in Phase 5.

export default function ProcurementQueuePlaceholder() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Procurement queue — placeholder
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Phase 5 not built yet.
        </h1>
        <p className="text-sm text-zinc-600">
          The pending-approval queue, Approve / Reject buttons and the live
          comstruct handoff will land here.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:border-zinc-400"
        >
          Back to role picker
        </Link>
      </div>
    </main>
  );
}
