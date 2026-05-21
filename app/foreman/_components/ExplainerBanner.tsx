"use client";

import { useState, useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";

const STORAGE_KEY = "siteorder.explainer.dismissed";

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function ExplainerBanner() {
  const storedDismissed = useSyncExternalStore(
    subscribeStorage,
    readDismissed,
    () => false, // SSR: render hidden so first paint matches, then reveal.
  );
  const [localDismissed, setLocalDismissed] = useState(false);
  const show = !storedDismissed && !localDismissed;

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setLocalDismissed(true);
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-amber-900">
          {copyDe["explainer.title"]}
        </p>
        <p className="text-sm leading-snug text-amber-900/90">
          {copyDe["explainer.body"]}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          {copyDe["explainer.dismiss"]}
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={copyDe["explainer.dismiss"]}
        className="rounded-md p-1 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
