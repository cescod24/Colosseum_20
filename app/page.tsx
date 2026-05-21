import { redirect } from "next/navigation";
import {
  DEMO_ROLES,
  type DemoRole,
  clearDemoRole,
  getDemoRole,
  setDemoRole,
} from "@/lib/role";

const ROLE_LABEL: Record<DemoRole, string> = {
  "foreman-a": "Polier A — Hochbau / PPE-lastig",
  "foreman-b": "Polier B — Werkzeug / Befestigung",
  procurement: "Procurement / Bauleiter",
};

const ROLE_TARGET: Record<DemoRole, string> = {
  "foreman-a": "/foreman",
  "foreman-b": "/foreman",
  procurement: "/procurement/queue",
};

async function pickRole(formData: FormData) {
  "use server";
  const role = formData.get("role");
  if (typeof role !== "string") return;
  const valid = (DEMO_ROLES as readonly string[]).includes(role);
  if (!valid) return;
  await setDemoRole(role as DemoRole);
  redirect(ROLE_TARGET[role as DemoRole]);
}

async function resetRole() {
  "use server";
  await clearDemoRole();
  redirect("/");
}

export default async function Page() {
  const current = await getDemoRole();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <header className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Site Order — Demo
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Wer bist du gerade?
          </h1>
          <p className="text-sm text-zinc-600">
            Schnellumschalter für die Demo. Keine echte Anmeldung — die Rolle
            wird in einem Cookie gespeichert.
          </p>
        </header>

        <div className="space-y-3">
          {DEMO_ROLES.map((role) => (
            <form key={role} action={pickRole}>
              <input type="hidden" name="role" value={role} />
              <button
                type="submit"
                className={`w-full rounded-xl border px-5 py-4 text-left text-base font-medium transition-colors ${
                  current === role
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                }`}
              >
                {ROLE_LABEL[role]}
              </button>
            </form>
          ))}
        </div>

        {current && (
          <form action={resetRole}>
            <button
              type="submit"
              className="w-full rounded-xl border border-transparent px-5 py-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              Rolle zurücksetzen
            </button>
          </form>
        )}

        <footer className="border-t border-zinc-100 pt-4 text-center text-xs text-zinc-400">
          {current ? (
            <>
              Aktive Rolle:{" "}
              <span className="font-mono text-zinc-600">{current}</span>
            </>
          ) : (
            <>Noch keine Rolle gewählt.</>
          )}
        </footer>
      </div>
    </main>
  );
}
