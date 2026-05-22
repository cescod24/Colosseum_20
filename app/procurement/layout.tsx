import { redirect } from "next/navigation";
import { HardHat, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { clearDemoRole, getDemoRole } from "@/lib/role";
import { copyEn } from "@/lib/constants/copy.en";
import { ProcurementNav, type NavItem } from "./_components/ProcurementNav";

async function switchRole() {
  "use server";
  await clearDemoRole();
  redirect("/");
}

export default async function ProcurementLayout({
  children,
}: {
  children: ReactNode;
}) {
  const role = await getDemoRole();
  if (role !== "procurement") {
    redirect("/");
  }

  const items: NavItem[] = [
    { href: "/procurement/queue", label: copyEn["nav.queue"] },
    { href: "/procurement/project", label: copyEn["nav.project"] },
    { href: "/procurement/catalog", label: copyEn["nav.catalog"] },
    { href: "/procurement/dashboard", label: copyEn["nav.dashboard"] },
    { href: "/procurement/ingest", label: "Ingest" },
    { href: "/procurement/ingest/punchout", label: copyEn["nav.punchout"] },
    { href: "/procurement/discover-test", label: "Discover" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex flex-none items-center gap-2 sm:gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <HardHat className="h-5 w-5" />
            </span>
            <span className="hidden flex-col leading-tight md:flex">
              <span className="font-display text-base font-bold tracking-tight text-zinc-900">
                Site Order
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                Procurement
              </span>
            </span>
          </div>

          <ProcurementNav items={items} />

          <div className="flex flex-none items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white sm:inline-flex">
              {copyEn["nav.role_pill"]}
            </span>
            <form action={switchRole}>
              <button
                type="submit"
                aria-label={copyEn["nav.switch_role"]}
                title={copyEn["nav.switch_role"]}
                className="flex items-center gap-1.5 rounded-lg p-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 sm:px-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {copyEn["nav.switch_role"]}
                </span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
