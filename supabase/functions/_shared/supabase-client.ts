// Shared Supabase client factory for Edge Functions
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase client using service_role key for write operations.
 * Edge Functions must set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */
export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}
