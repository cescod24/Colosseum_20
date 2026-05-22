import Link from "next/link";
import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import type { ReactNode } from "react";
import { clearDemoRole, getDemoRole } from "@/lib/role";
import { copyEn } from "@/lib/constants/copy.en";

async function switchRole() {
  "use server";
  await clearDemoRole();
  redirect("/");
}

type NavItem = { href: string; label: string };

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
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
              <HardHat className="h-5 w-5" />
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold text-zinc-900">
                Site Order
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Procurement
              </span>
            </span>
          </div>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto px-1 text-sm sm:gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-none items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white sm:inline-flex">
              {copyEn["nav.role_pill"]}
            </span>
            <form action={switchRole}>
              <button
                type="submit"
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                {copyEn["nav.switch_role"]}
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
