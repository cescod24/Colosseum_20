"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

function activeItem(items: NavItem[], pathname: string): NavItem | undefined {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  // Longest matching prefix wins, so /procurement/ingest/punchout picks
  // "Punchout" over the shorter "Ingest" match.
  return items
    .filter((i) => pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function ProcurementNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = activeItem(items, pathname);

  // Close the mobile dropdown on navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Close on outside click / Escape while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop: inline links, active one highlighted. */}
      <nav className="hidden flex-1 items-center gap-1 overflow-x-auto px-1 text-sm sm:flex">
        {items.map((item) => {
          const isActive = active?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-amber-100 text-amber-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: a single dropdown trigger showing the current section. */}
      <div ref={ref} className="relative flex-1 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <Menu className="h-4 w-4 text-zinc-500" />
            <span className="truncate">{active?.label ?? "Menu"}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
          >
            {items.map((item) => {
              const isActive = active?.href === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium",
                    isActive
                      ? "bg-amber-50 text-amber-900"
                      : "text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  {item.label}
                  {isActive && <Check className="h-4 w-4 text-amber-600" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
