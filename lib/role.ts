// Dev role switcher — sets/reads an `x-demo-user` cookie with one of:
//   'foreman-a' | 'foreman-b' | 'procurement'
//
// There is no real auth in the MVP (see plan.md §2). All RLS policies in
// 0001_init.sql are written as if Supabase Auth were live; the demo uses the
// service-role key to bypass them, and this cookie tells the server which
// seeded profile to act as.

import { cookies } from "next/headers";

export const DEMO_USER_COOKIE = "x-demo-user";

export const DEMO_ROLES = ["foreman-a", "foreman-b", "procurement"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export function isDemoRole(value: string | undefined): value is DemoRole {
  return typeof value === "string" && (DEMO_ROLES as readonly string[]).includes(value);
}

/** Read the current demo role from the request cookies (server components / route handlers). */
export async function getDemoRole(): Promise<DemoRole | null> {
  const store = await cookies();
  const raw = store.get(DEMO_USER_COOKIE)?.value;
  return isDemoRole(raw) ? raw : null;
}

/**
 * Persist a new demo role on the response cookies. Must run inside a
 * server action or a route handler — `next/headers` cookies() is read-only
 * inside plain server components.
 */
export async function setDemoRole(role: DemoRole): Promise<void> {
  const store = await cookies();
  store.set(DEMO_USER_COOKIE, role, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    // demo only — no need for Secure in localhost
  });
}

export async function clearDemoRole(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_USER_COOKIE);
}
