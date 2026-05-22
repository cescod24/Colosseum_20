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
//
// Mobile safe-area: padding-bottom honours `env(safe-area-inset-bottom)` so
// the bar clears the iOS home indicator on notched devices.

type Props = {
  currentPath:
    | "/foreman"
    | "/foreman/orders"
    | "/foreman/discover"
    | "/foreman/info";
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto flex h-16 w-full max-w-md items-stretch justify-between px-1 sm:px-2">
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

        {/* Spacer that reserves room for the floating center FAB so the four
            side items don't bunch behind it on narrow phones. */}
        <div aria-hidden className="w-16 shrink-0" />

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

        {/* Center AI FAB — absolutely positioned so it doesn't deform the
            flex layout, and shifted half its height above the nav baseline.
            Sits above its own dedicated spacer (above), so the layout never
            collapses on tiny screens. */}
        <button
          type="button"
          onClick={onAssistantTap}
          aria-label={copyDe["nav.ai"]}
          className="absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/3 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-hover text-brand shadow-lg ring-4 ring-white transition-transform hover:scale-105 active:scale-95"
        >
          <Sparkles className="h-6 w-6" />
        </button>
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
        "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-none transition-colors " +
        (active ? "text-brand" : "text-zinc-500 hover:text-zinc-900")
      }
      aria-current={active ? "page" : undefined}
    >
      <span className={active ? "" : "opacity-80"}>{icon}</span>
      <span className="truncate">{label}</span>
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
      className="relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-none text-zinc-500 transition-colors hover:text-zinc-900"
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
      <span className="truncate">{label}</span>
    </button>
  );
}
