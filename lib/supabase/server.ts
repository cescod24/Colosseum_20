// Server-only Supabase client. Uses the SERVICE-ROLE key, so it can read and
// write anything in the database — never expose this client to the browser
// or to any code that ships down to client components.
//
// Step 0 ships the factory; route handlers call `getServerClient()` when
// they need DB access.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — set them in .env.local",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
