import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Anonymous, cookie-free server client for public catalog reads.
 * Uses the same NEXT_PUBLIC keys as /events. Never the service role.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
