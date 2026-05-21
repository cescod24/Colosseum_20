"use client";

import Link from "next/link";
import { useState } from "react";
import type { DiscoverResponse } from "@/lib/schema";

const PRESETS = [
  "Fenster abdichten",
  "Gipskarton auf Metallständer befestigen",
  "Werkzeug nachbestellen",
  "Beton bestellen",
];

type Body = DiscoverResponse & { redirect?: boolean; message?: string };

export default function DiscoverTestPage() {
  const [task, setTask] = useState("Fenster abdichten");
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState<Body | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(q: string) {
    setTask(q);
    setBusy(true);
    setError(null);
    setBody(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: q }),
      });
      const data = (await res.json()) as Body;
      if (!res.ok) {
        setError(data?.message ?? `HTTP ${res.status}`);
      } else {
        setBody(data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Dev tool · POST /api/discover
        </p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Discover smoke test</h1>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← role picker
          </Link>
        </div>
        <p className="text-sm text-zinc-600">
          The foreman discovery UI is owned by slice A. This page is a dev
          tool for slice C to verify the backend returns sensible items and
          that A-material searches short-circuit.
        </p>
      </header>

      <form
        className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200"
        onSubmit={(e) => {
          e.preventDefault();
          send(task);
        }}
      >
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400"
            >
              {p}
            </button>
          ))}
          <button
            type="submit"
            disabled={busy}
            className="ml-auto rounded-xl bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:bg-zinc-300"
          >
            {busy ? "…" : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {body && body.redirect && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">A-material redirect fired ✓</p>
          <p className="mt-1">{body.message}</p>
        </div>
      )}

      {body && !body.redirect && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>
              {body.items.length} item{body.items.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{body.canned ? "Canned response" : "Live OpenAI call"}</span>
          </div>
          {body.items.length === 0 ? (
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
              Nichts gefunden — probier eine Kategorie.
            </div>
          ) : (
            <ul className="space-y-2">
              {body.items.map((it) => (
                <li
                  key={it.product_id + it.supplier_sku}
                  className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{it.name}</span>
                    <code className="text-xs text-zinc-500">{it.supplier_sku}</code>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{it.reason}</p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {it.product_group ?? "—"} · {it.unit}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
