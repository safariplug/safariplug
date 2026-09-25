import { supabaseAdmin } from "@/lib/supabase-admin";

export type DriverTrustCandidate = {
  id: string;
  identity_liveness_verified_at?: string | null;
};

export async function currentVerifiedDriverIds<T extends DriverTrustCandidate>(drivers: T[]) {
  const ids = drivers.map((driver) => driver.id);
  if (!ids.length) return new Set<string>();

  const { data: cases, error } = await supabaseAdmin
    .from("verification_cases")
    .select("subject_id,provider,status,expires_at")
    .eq("subject_type", "driver")
    .in("subject_id", ids)
    .eq("status", "approved");

  if (error) throw error;

  const now = Date.now();
  const currentByDriver = new Map<string, string[]>();
  for (const row of cases ?? []) {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
    const id = String(row.subject_id);
    const providers = currentByDriver.get(id) ?? [];
    providers.push(String(row.provider || ""));
    currentByDriver.set(id, providers);
  }

  return new Set(
    drivers
      .filter((driver) => {
        const providers = currentByDriver.get(driver.id) ?? [];
        return providers.includes("human_review") ||
          (Boolean(driver.identity_liveness_verified_at) && providers.length > 0);
      })
      .map((driver) => driver.id),
  );
}

export async function driverVerificationCurrent(driver: DriverTrustCandidate) {
  return (await currentVerifiedDriverIds([driver])).has(driver.id);
}

export function currentCompliance(status: string | null | undefined) {
  return status === "valid" || status === "expiring_soon";
}
