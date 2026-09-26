import { supabaseAdmin } from "@/lib/supabase-admin";

export async function verifiedServiceProviderUserIds(userIds: Array<string | null | undefined>) {
  const unique = [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unique.length) return new Set<string>();

  const checks = await Promise.all(unique.map(async (userId) => {
    const { data, error } = await supabaseAdmin.rpc("service_provider_verification_ready", { p_user_id: userId });
    if (error) {
      console.error("service provider verification check failed", { userId, error: error.message });
      return [userId, false] as const;
    }
    return [userId, data === true] as const;
  }));

  return new Set(checks.filter(([, ready]) => ready).map(([userId]) => userId));
}

export async function isServiceProviderVerified(userId: string | null | undefined) {
  const id = String(userId || "").trim();
  if (!id) return false;
  const ready = await verifiedServiceProviderUserIds([id]);
  return ready.has(id);
}
