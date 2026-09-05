import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type UserClientResult =
  | { ok: true; client: SupabaseClient; accessToken: string }
  | { ok: false; reason: "config" | "auth" };

export function getSupabaseUserClient(request: Request): UserClientResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return { ok: false, reason: "config" };
  }

  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "auth" };
  }
  const accessToken = header.slice(7).trim();
  if (!accessToken) {
    return { ok: false, reason: "auth" };
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  return { ok: true, client, accessToken };
}

export async function getRequestUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
