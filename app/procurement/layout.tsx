import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { clearDemoRole, getDemoRole } from "@/lib/role";
import { copyEn } from "@/lib/constants/copy.en";

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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Site Order
            </span>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/procurement/queue"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                {copyEn["nav.queue"]}
              </Link>
              <Link
                href="/procurement/project"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                {copyEn["nav.project"]}
              </Link>
              <Link
                href="/procurement/catalog"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                {copyEn["nav.catalog"]}
              </Link>
              <Link
                href="/procurement/dashboard"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                {copyEn["nav.dashboard"]}
              </Link>
              <Link
                href="/procurement/ingest"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                Ingest
              </Link>
              <Link
                href="/procurement/ingest/punchout"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                {copyEn["nav.punchout"]}
              </Link>
              <Link
                href="/procurement/discover-test"
                className="font-medium text-zinc-900 hover:text-zinc-600"
              >
                Discover
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
