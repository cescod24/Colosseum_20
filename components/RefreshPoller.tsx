"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Drops into any server-rendered page to keep it live: calls
// router.refresh() on an interval, which re-runs the page's server
// components and streams fresh data without a full reload (client component
// state — carts, inputs — is preserved). Renders nothing.
//
// Pause while the tab is hidden so we don't hammer the DB in the background.

export function RefreshPoller({ intervalMs = 1000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
