"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNavBar } from "./BottomNavBar";

const CART_STORAGE_KEY = "siteorder.cart.v1";

type CartLine = { product_id: string; qty: number };

// Drop-in BottomNavBar wrapper for foreman pages that are server-rendered
// (and therefore can't own the cart state). Reads cart count from
// localStorage and routes cart/AI taps back to the foreman home with the
// matching query param. Use on /foreman/orders/[id] and /foreman/info.

export function ForemanFooterNav({
  currentPath,
}: {
  currentPath:
    | "/foreman"
    | "/foreman/orders"
    | "/foreman/discover"
    | "/foreman/info";
}) {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);

  // One-shot hydrate after mount + listen for storage changes from other
  // tabs / sheets so the badge stays in sync.
  useEffect(() => {
    function read() {
      if (typeof window === "undefined") return 0;
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (!raw) return 0;
        const arr = JSON.parse(raw) as CartLine[];
        return Array.isArray(arr) ? arr.length : 0;
      } catch {
        return 0;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCartCount(read());
    function onStorage(e: StorageEvent) {
      if (e.key !== CART_STORAGE_KEY) return;
      setCartCount(read());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <>
      <BottomNavBar
        currentPath={currentPath}
        cartCount={cartCount}
        onCartTap={() => router.push("/foreman?cart=1")}
        onAssistantTap={() => router.push("/foreman?ai=1")}
      />
      <div className="h-20" aria-hidden />
    </>
  );
}
