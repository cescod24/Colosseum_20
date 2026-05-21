import Link from "next/link";

// Placeholder — the real foreman home lands in Phase 2 (banner, "letzter
// Auftrag", kit tiles, "Am meisten bestellt", cart bar).

export default function ForemanHomePlaceholder() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Foreman home — Platzhalter
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Phase 2 ist noch nicht gebaut.
        </h1>
        <p className="text-sm text-zinc-600">
          Hier landet später die Bestelloberfläche (Banner, letzter Auftrag,
          Sets, „Am meisten bestellt“, Warenkorb).
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:border-zinc-400"
        >
          Zurück zur Rollenwahl
        </Link>
      </div>
    </main>
  );
}
