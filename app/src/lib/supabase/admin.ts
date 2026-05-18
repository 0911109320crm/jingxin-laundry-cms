import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the service role key.
 * Bypasses RLS — only use in Server Actions / Route Handlers that have already
 * verified the caller's role via requireRole().
 *
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
