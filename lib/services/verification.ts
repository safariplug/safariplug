import { liveVerificationAdapters } from "@/lib/integrations/verification/registry";
import type {
  DriverTrustStatus,
  EvidenceType,
  PublicTrustSignal,
  SafeEvidenceView,
  VerificationCase,
  VerificationError,
  VerificationEvent,
  VerificationEvidence,
  VerificationLevel,
  VerificationResult,
  VerificationSubjectType,
} from "@/lib/integrations/verification/types";
import type { DriverProfile } from "@/lib/integrations/drivers/types";
import type { DriverStore } from "./drivers";

export type VerificationActor = {
  role: "admin" | "system" | "traveler" | "anonymous";
  id?: string;
};

export type VerificationStore = {
  listCases(): VerificationCase[];
  getCase(id: string): VerificationCase | undefined;
  saveCase(row: VerificationCase): void;
  updateCase(
    id: string,
    patch: Partial<VerificationCase>
  ): VerificationCase | undefined;
  listEvidence(caseId: string): VerificationEvidence[];
  saveEvidence(row: VerificationEvidence): void;
  listEvents(caseId: string): VerificationEvent[];
  saveEvent(row: VerificationEvent): void;
};

export class MemoryVerificationStore implements VerificationStore {
  constructor(
    private cases: VerificationCase[] = [],
    private evidence: VerificationEvidence[] = [],
    private events: VerificationEvent[] = []
  ) {}
  listCases() {
    return [...this.cases];
  }
  getCase(id: string) {
    return this.cases.find((row) => row.id === id);
  }
  saveCase(row: VerificationCase) {
    this.cases.push(row);
  }
  updateCase(id: string, patch: Partial<VerificationCase>) {
    const row = this.cases.find((item) => item.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updated_at: now() });
    return row;
  }
  listEvidence(caseId: string) {
    return this.evidence.filter((row) => row.case_id === caseId);
  }
  saveEvidence(row: VerificationEvidence) {
    this.evidence.push(row);
  }
  listEvents(caseId: string) {
    return this.events.filter((row) => row.case_id === caseId);
  }
  saveEvent(row: VerificationEvent) {
    this.events.push(row);
  }
}

const productionStore = new MemoryVerificationStore();

function now() {
  return new Date().toISOString();
}

function fail(
  code: VerificationError["code"],
  message: string
): VerificationResult<never> {
  return { ok: false, error: { code, message } };
}

function requireAdmin(
  actor: VerificationActor
): VerificationResult<never> | null {
  if (actor.role !== "admin" && actor.role !== "system") {
    return fail("unauthorized", "Verification is admin/service-only.");
  }
  return null;
}

export function requiredEvidenceTypes(
  level: VerificationLevel
): EvidenceType[] {
  const live = liveVerificationAdapters();
  const livenessLive = live.some((adapter) => adapter.capabilities().liveness);
  if (level === "basic") return ["provider_attestation"];
  if (level === "identity") {
    const types: EvidenceType[] = ["identity"];
    if (livenessLive) types.push("liveness");
    return types;
  }
  const types: EvidenceType[] = ["identity", "license"];
  if (livenessLive) types.push("liveness");
  return types;
}

export function evidenceSatisfied(
  level: VerificationLevel,
  evidence: VerificationEvidence[]
): boolean {
  const required = requiredEvidenceTypes(level);
  return required.every((type) =>
    evidence.some(
      (row) =>
        row.evidence_type === type &&
        (row.status === "submitted" || row.status === "accepted") &&
        (!row.expires_at || row.expires_at > now())
    )
  );
}

export function toSafeEvidence(row: VerificationEvidence): SafeEvidenceView {
  return {
    id: row.id,
    evidence_type: row.evidence_type,
    status: row.status,
    provider: row.provider,
    submitted_at: row.submitted_at,
  };
}

export function latestCaseForSubject(
  store: VerificationStore,
  subjectType: VerificationSubjectType,
  subjectId: string
): VerificationCase | undefined {
  return store
    .listCases()
    .filter(
      (row) => row.subject_type === subjectType && row.subject_id === subjectId
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function getDriverTrustStatus(
  driver: Pick<DriverProfile, "id" | "verification_state">,
  store?: VerificationStore
): DriverTrustStatus {
  const current = store
    ? latestCaseForSubject(store, "driver", driver.id)
    : undefined;
  if (current) {
    if (current.status === "approved") {
      if (current.expires_at && current.expires_at <= now()) {
        return "verification_expired";
      }
      return "verified";
    }
    if (current.status === "pending" || current.status === "in_review") {
      return "verification_pending";
    }
    if (current.status === "rejected") return "rejected";
    if (current.status === "revoked") return "verification_revoked";
    if (current.status === "expired") return "verification_expired";
  }
  if (driver.verification_state === "verified") return "verified";
  if (driver.verification_state === "pending") return "verification_pending";
  if (driver.verification_state === "rejected") return "rejected";
  return "unverified";
}

export function toPublicTrustSignal(
  status: DriverTrustStatus,
  level: VerificationLevel | null,
  subjectType: VerificationSubjectType
): PublicTrustSignal | null {
  if (status !== "verified" || !level) return null;
  const badge =
    subjectType === "provider"
      ? "verified_provider"
      : subjectType === "vehicle"
        ? "vehicle_verified"
        : "verified_driver";
  const badges: PublicTrustSignal["trustBadges"] = [badge];
  if (level === "identity" || level === "enhanced") {
    badges.push("identity_verified");
  }
  return {
    verified: true,
    verificationLevel: level,
    trustBadges: badges,
  };
}

function appendEvent(
  store: VerificationStore,
  input: {
    caseId: string;
    eventType: string;
    from: string | null;
    to: string | null;
    actor: VerificationActor;
    reason?: string;
  }
) {
  store.saveEvent({
    id: `vev_${crypto.randomUUID()}`,
    case_id: input.caseId,
    event_type: input.eventType,
    from_status: input.from,
    to_status: input.to,
    actor: input.actor.id || input.actor.role,
    provider: "human_review",
    external_ref: null,
    reason: input.reason ?? null,
    created_at: now(),
  });
}

export function createVerificationCase(
  input: {
    subject_type: VerificationSubjectType;
    subject_id: string;
    verification_level?: VerificationLevel;
    notes?: string;
  },
  actor: VerificationActor,
  store: VerificationStore = productionStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  if (!input.subject_id.trim()) {
    return fail("bad_request", "subject_id is required.");
  }
  const row: VerificationCase = {
    id: crypto.randomUUID(),
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    status: "not_started",
    verification_level: input.verification_level ?? "basic",
    provider: "human_review",
    external_id: null,
    reviewed_by: null,
    reviewed_at: null,
    expires_at: null,
    rejection_reason: null,
    notes: input.notes ?? null,
    created_at: now(),
    updated_at: now(),
  };
  store.saveCase(row);
  appendEvent(store, {
    caseId: row.id,
    eventType: "created",
    from: null,
    to: "not_started",
    actor,
  });
  return { ok: true, data: row };
}

export function submitEvidence(
  input: {
    case_id: string;
    evidence_type: EvidenceType;
    storage_ref?: string;
    external_ref?: string;
  },
  actor: VerificationActor,
  store: VerificationStore = productionStore
): VerificationResult<SafeEvidenceView> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  const current = store.getCase(input.case_id);
  if (!current) return fail("not_found", "Verification case not found.");
  if (current.status === "approved" || current.status === "revoked") {
    return fail("conflict", "Cannot add evidence to a closed case.");
  }
  const row: VerificationEvidence = {
    id: crypto.randomUUID(),
    case_id: current.id,
    evidence_type: input.evidence_type,
    status: "submitted",
    provider: "human_review",
    external_ref: input.external_ref ?? null,
    storage_ref: input.storage_ref ?? null,
    submitted_at: now(),
    reviewed_at: null,
    expires_at: null,
    rejection_reason: null,
  };
  store.saveEvidence(row);
  if (current.status === "not_started") {
    store.updateCase(current.id, { status: "pending" });
    appendEvent(store, {
      caseId: current.id,
      eventType: "submitted",
      from: "not_started",
      to: "pending",
      actor,
    });
  }
  return { ok: true, data: toSafeEvidence(row) };
}

export function requestReview(
  caseId: string,
  actor: VerificationActor,
  store: VerificationStore = productionStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  const current = store.getCase(caseId);
  if (!current) return fail("not_found", "Verification case not found.");
  if (current.status !== "pending" && current.status !== "not_started") {
    return fail("conflict", "Case cannot enter review from the current state.");
  }
  const updated = store.updateCase(caseId, { status: "in_review" })!;
  appendEvent(store, {
    caseId,
    eventType: "in_review",
    from: current.status,
    to: "in_review",
    actor,
  });
  return { ok: true, data: updated };
}

function applySubjectState(
  current: VerificationCase,
  state: "verified" | "unverified" | "rejected" | "pending",
  driverStore?: DriverStore
) {
  if (current.subject_type !== "driver" || !driverStore) return;
  const driver = driverStore.getDriver(current.subject_id);
  if (!driver) return;
  driver.verification_state = state;
}

export function approveCase(
  caseId: string,
  actor: VerificationActor,
  store: VerificationStore = productionStore,
  driverStore?: DriverStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  const current = store.getCase(caseId);
  if (!current) return fail("not_found", "Verification case not found.");
  if (current.status !== "in_review") {
    return fail("conflict", "Approval requires an in-review case.");
  }
  if (!evidenceSatisfied(current.verification_level, store.listEvidence(caseId))) {
    return fail(
      "evidence_required",
      `Approval requires evidence: ${requiredEvidenceTypes(current.verification_level).join(", ")}.`
    );
  }
  const updated = store.updateCase(caseId, {
    status: "approved",
    reviewed_by: actor.id || actor.role,
    reviewed_at: now(),
    rejection_reason: null,
  })!;
  appendEvent(store, {
    caseId,
    eventType: "approved",
    from: current.status,
    to: "approved",
    actor,
  });
  applySubjectState(updated, "verified", driverStore);
  return { ok: true, data: updated };
}

export function rejectCase(
  caseId: string,
  reason: string,
  actor: VerificationActor,
  store: VerificationStore = productionStore,
  driverStore?: DriverStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  if (!reason.trim()) return fail("bad_request", "Rejection requires a reason.");
  const current = store.getCase(caseId);
  if (!current) return fail("not_found", "Verification case not found.");
  if (current.status !== "in_review" && current.status !== "pending") {
    return fail("conflict", "Case cannot be rejected from the current state.");
  }
  const updated = store.updateCase(caseId, {
    status: "rejected",
    reviewed_by: actor.id || actor.role,
    reviewed_at: now(),
    rejection_reason: reason.trim(),
  })!;
  appendEvent(store, {
    caseId,
    eventType: "rejected",
    from: current.status,
    to: "rejected",
    actor,
    reason: reason.trim(),
  });
  applySubjectState(updated, "rejected", driverStore);
  return { ok: true, data: updated };
}

export function revokeCase(
  caseId: string,
  reason: string,
  actor: VerificationActor,
  store: VerificationStore = productionStore,
  driverStore?: DriverStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  if (!reason.trim()) return fail("bad_request", "Revocation requires a reason.");
  const current = store.getCase(caseId);
  if (!current) return fail("not_found", "Verification case not found.");
  if (current.status !== "approved") {
    return fail("conflict", "Only an approved case can be revoked.");
  }
  const updated = store.updateCase(caseId, {
    status: "revoked",
    reviewed_by: actor.id || actor.role,
    reviewed_at: now(),
    rejection_reason: reason.trim(),
  })!;
  appendEvent(store, {
    caseId,
    eventType: "revoked",
    from: current.status,
    to: "revoked",
    actor,
    reason: reason.trim(),
  });
  applySubjectState(updated, "unverified", driverStore);
  return { ok: true, data: updated };
}

export function expireCase(
  caseId: string,
  actor: VerificationActor,
  store: VerificationStore = productionStore,
  driverStore?: DriverStore
): VerificationResult<VerificationCase> {
  const denied = requireAdmin(actor);
  if (denied) return denied;
  const current = store.getCase(caseId);
  if (!current) return fail("not_found", "Verification case not found.");
  const updated = store.updateCase(caseId, { status: "expired" })!;
  appendEvent(store, {
    caseId,
    eventType: "expired",
    from: current.status,
    to: "expired",
    actor,
  });
  applySubjectState(updated, "unverified", driverStore);
  return { ok: true, data: updated };
}

export function clientsCannotMarkVerified(): true {
  return true;
}

export { productionStore as defaultVerificationStore };
