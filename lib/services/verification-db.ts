import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  VerificationCase,
  VerificationEvent,
  VerificationEvidence,
} from "@/lib/integrations/verification/types";
import { MemoryVerificationStore } from "./verification";

type DbClient = Pick<SupabaseClient, "from" | "rpc">;

function asCases(rows: unknown): VerificationCase[] {
  if (!Array.isArray(rows)) return [];
  return rows as VerificationCase[];
}
function asEvidence(rows: unknown): VerificationEvidence[] {
  if (!Array.isArray(rows)) return [];
  return rows as VerificationEvidence[];
}
function asEvents(rows: unknown): VerificationEvent[] {
  if (!Array.isArray(rows)) return [];
  return rows as VerificationEvent[];
}

export async function hydrateVerificationStore(client: DbClient): Promise<{
  ok: true;
  store: MemoryVerificationStore;
} | { ok: false; reason: "missing" | "db" }> {
  const cases = await client.from("verification_cases").select("*");
  if (cases.error) {
    if (/does not exist|schema cache/i.test(cases.error.message)) {
      return { ok: false, reason: "missing" };
    }
    return { ok: false, reason: "db" };
  }
  const evidence = await client.from("verification_evidence").select(
    "id, case_id, evidence_type, status, provider, external_ref, storage_ref, submitted_at, reviewed_at, expires_at, rejection_reason"
  );
  const events = await client.from("verification_events").select(
    "id, case_id, event_type, from_status, to_status, actor, provider, external_ref, reason, created_at"
  );
  if (evidence.error || events.error) return { ok: false, reason: "db" };
  return {
    ok: true,
    store: new MemoryVerificationStore(
      asCases(cases.data),
      asEvidence(evidence.data),
      asEvents(events.data)
    ),
  };
}

export async function persistVerificationMutation(
  client: DbClient,
  store: MemoryVerificationStore,
  caseId: string
): Promise<{ ok: true } | { ok: false }> {
  const current = store.getCase(caseId);
  if (!current) return { ok: false };
  const { error: caseError } = await client
    .from("verification_cases")
    .upsert(current);
  if (caseError) {
    console.error("verification.persist.case", caseError.message);
    return { ok: false };
  }
  for (const row of store.listEvidence(caseId)) {
    const { error } = await client.from("verification_evidence").upsert({
      id: row.id,
      case_id: row.case_id,
      evidence_type: row.evidence_type,
      status: row.status,
      provider: row.provider,
      external_ref: row.external_ref,
      storage_ref: row.storage_ref,
      submitted_at: row.submitted_at,
      reviewed_at: row.reviewed_at,
      expires_at: row.expires_at,
      rejection_reason: row.rejection_reason,
      metadata: {},
    });
    if (error) {
      console.error("verification.persist.evidence", error.message);
      return { ok: false };
    }
  }
  for (const row of store.listEvents(caseId)) {
    const { error } = await client.from("verification_events").insert({
      id: row.id,
      case_id: row.case_id,
      event_type: row.event_type,
      from_status: row.from_status,
      to_status: row.to_status,
      actor: row.actor,
      provider: row.provider,
      external_ref: row.external_ref,
      reason: row.reason,
      created_at: row.created_at,
      metadata: {},
    });
    if (error && error.code !== "23505" && !/duplicate key/i.test(error.message)) {
      console.error("verification.persist.event", error.message);
      return { ok: false };
    }
  }
  if (current.subject_type === "driver") {
    const state =
      current.status === "approved"
        ? "verified"
        : current.status === "rejected"
          ? "rejected"
          : current.status === "pending" || current.status === "in_review"
            ? "pending"
            : "unverified";
    const { error } = await client.rpc("apply_driver_verification_state", {
      p_driver_id: current.subject_id,
      p_state: state,
      p_case_id: current.id,
    });
    if (error) {
      console.error("verification.apply_driver", error.message);
    }
  }
  return { ok: true };
}
