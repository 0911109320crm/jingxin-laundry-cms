import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";

/**
 * Append a row to public.audit_logs.
 *
 * Errors are swallowed: a failing audit insert must NEVER break the
 * primary action it accompanies.
 */
export async function logAudit(input: {
  action: string;
  target_type?: string;
  target_id?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const me = await getCurrentUser();
    if (!me) return;
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      user_id: me.id,
      action: input.action,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      payload: input.payload ?? null,
    });
  } catch {
    /* swallowed */
  }
}
