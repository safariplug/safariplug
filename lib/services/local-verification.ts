import { supabaseAdmin } from "@/lib/supabase-admin";

export type LocalTrustCandidate = {
  id: string;
  identity_liveness_verified_at?: string | null;
};

export async function currentVerifiedLocalIds<T extends LocalTrustCandidate>(locals: T[]) {
  const ids = locals.map((local) => local.id);
  if (!ids.length) return new Set<string>();

  const { data: cases, error } = await supabaseAdmin
    .from("verification_cases")
    .select("subject_id,status,expires_at")
    .eq("subject_type", "local")
    .in("subject_id", ids)
    .eq("status", "approved");

  if (error) throw error;
  const now = Date.now();
  const current = new Set(
    (cases ?? [])
      .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
      .map((row) => String(row.subject_id))
  );

  return new Set(
    locals
      .filter((local) => Boolean(local.identity_liveness_verified_at) && current.has(local.id))
      .map((local) => local.id)
  );
}

export async function localVerificationCurrent(local: LocalTrustCandidate) {
  return (await currentVerifiedLocalIds([local])).has(local.id);
}
