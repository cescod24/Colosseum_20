import { redirect } from "next/navigation";
import { HardHat, Wrench, ClipboardCheck } from "lucide-react";
import {
  DEMO_ROLES,
  type DemoRole,
  clearDemoRole,
  getDemoRole,
  setDemoRole,
} from "@/lib/role";

type Persona = {
  name: string;
  role: string;
  context: string;
  Icon: typeof HardHat;
  accent: string;
};

const PERSONA: Record<DemoRole, Persona> = {
  "foreman-a": {
    name: "Stefan Müller",
    role: "Polier · Hochbau",
    context: "Baustelle Zürich-West · PPE & Verbrauchsmaterial",
    Icon: HardHat,
    accent: "from-amber-500 to-orange-500",
  },
  "foreman-b": {
    name: "Marco Bianchi",
    role: "Polier · Trockenbau",
    context: "Werkzeug & Befestigung · Bestellt regelmäßig",
    Icon: Wrench,
    accent: "from-sky-500 to-indigo-500",
  },
  procurement: {
    name: "Anna Keller",
    role: "Bauleitung & Procurement",
    context: "Rahmenverträge · Genehmigt > 200 CHF",
    Icon: ClipboardCheck,
    accent: "from-emerald-500 to-teal-500",
  },
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
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-zinc-50 via-zinc-50 to-amber-50/30 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800">
            <HardHat className="h-3.5 w-3.5" />
            Site Order
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Wer bist du gerade?
          </h1>
          <p className="mx-auto max-w-xs text-sm text-zinc-600">
            C-Material schnell bestellen — für die Baustelle, ohne Telefon
            und ohne Excel.
          </p>
        </header>

        <div className="space-y-3">
          {DEMO_ROLES.map((role) => {
            const p = PERSONA[role];
            const Icon = p.Icon;
            const active = current === role;
            return (
              <form key={role} action={pickRole}>
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  className={`group flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-px hover:shadow-md ${
                    active
                      ? "border-zinc-900 ring-2 ring-zinc-900"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <span
                    className={`inline-flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${p.accent} text-white shadow-sm`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="flex-1 space-y-0.5">
                    <span className="block text-base font-semibold text-zinc-900">
                      {p.name}
                    </span>
                    <span className="block text-xs font-medium text-zinc-600">
                      {p.role}
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      {p.context}
                    </span>
                  </span>
                </button>
              </form>
            );
          })}
        </div>

        {current && (
          <form action={resetRole}>
            <button
              type="submit"
              className="w-full rounded-xl px-5 py-2 text-sm text-zinc-500 hover:text-zinc-900"
            >
              Rolle zurücksetzen
            </button>
          </form>
        )}

        <footer className="text-center text-[11px] text-zinc-400">
          {current ? (
            <>
              Aktive Rolle:{" "}
              <span className="font-mono text-zinc-600">{current}</span>
            </>
          ) : (
            <>Demo · keine echte Anmeldung · Rolle im Cookie</>
          )}
        </footer>
      </div>
    </main>
  );
}
