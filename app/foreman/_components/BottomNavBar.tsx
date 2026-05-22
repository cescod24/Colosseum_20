"use client";

import Link from "next/link";
import { ClipboardList, Home, Search, ShoppingCart, Sparkles } from "lucide-react";

import { copyDe } from "@/lib/constants/copy.de";

// Fixed bottom navigation. Replaces the old sticky CartBar.
//
// Five items; the center "AI" button is taller, gradient, and triggers the
// AssistantSheet via the onAssistantTap callback (handled by the parent so
// the sheet state can live alongside the page's cart state).
//
// `currentPath` is used purely to style the active item; pass the page's own
// path (e.g. "/foreman", "/foreman/orders", "/foreman/discover").

type Props = {
  currentPath: "/foreman" | "/foreman/orders" | "/foreman/discover";
  cartCount: number;
  onCartTap: () => void;
  onAssistantTap: () => void;
};

export function BottomNavBar({
  currentPath,
  cartCount,
  onCartTap,
  onAssistantTap,
}: Props) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        <NavLink
          href="/foreman"
          icon={<Home className="h-5 w-5" />}
          label={copyDe["nav.home"]}
          active={currentPath === "/foreman"}
        />
        <NavButton
          onTap={onCartTap}
          icon={<ShoppingCart className="h-5 w-5" />}
          label={copyDe["nav.cart"]}
          badge={cartCount}
        />

        {/* Center AI button — taller, gradient, takes the focus */}
        <button
          type="button"
          onClick={onAssistantTap}
          aria-label={copyDe["nav.ai"]}
          className="relative -top-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 text-white shadow-lg ring-4 ring-white transition-transform hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-6 w-6" />
        </button>

        <NavLink
          href="/foreman/orders"
          icon={<ClipboardList className="h-5 w-5" />}
          label={copyDe["nav.orders"]}
          active={currentPath === "/foreman/orders"}
        />
        <NavLink
          href="/foreman/discover"
          icon={<Search className="h-5 w-5" />}
          label={copyDe["nav.discover"]}
          active={currentPath === "/foreman/discover"}
        />
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors " +
        (active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900")
      }
      aria-current={active ? "page" : undefined}
    >
      <span className={active ? "" : "opacity-80"}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function NavButton({
  onTap,
  icon,
  label,
  badge,
}: {
  onTap: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
    >
      <span className="relative opacity-80">
        {icon}
        {!!badge && badge > 0 && (
          <span
            aria-label="Warenkorb hat Artikel"
            className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white"
          />
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}
