export const VERIFICATION_SUBJECT_TYPES = [
  "driver",
  "provider",
  "vehicle",
] as const;
export type VerificationSubjectType = (typeof VERIFICATION_SUBJECT_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "not_started",
  "pending",
  "in_review",
  "approved",
  "rejected",
  "expired",
  "revoked",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LEVELS = ["basic", "identity", "enhanced"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const EVIDENCE_TYPES = [
  "identity",
  "selfie",
  "liveness",
  "license",
  "insurance",
  "vehicle_registration",
  "business_registration",
  "address",
  "safety_check",
  "background_check",
  "provider_attestation",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_STATUSES = [
  "submitted",
  "accepted",
  "rejected",
  "expired",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const DRIVER_TRUST_STATUSES = [
  "unverified",
  "verification_pending",
  "verified",
  "verification_expired",
  "verification_revoked",
  "rejected",
] as const;
export type DriverTrustStatus = (typeof DRIVER_TRUST_STATUSES)[number];

export type VerificationProviderKey =
  | "human_review"
  | "identity_provider"
  | "liveness_provider"
  | "document_provider"
  | "background_provider";

export type VerificationProviderStatus =
  | "unavailable"
  | "not_configured"
  | "configured"
  | "healthy"
  | "degraded"
  | "disabled";

export type VerificationAdapterCapabilities = {
  identity: boolean;
  document: boolean;
  liveness: boolean;
  background: boolean;
  insurance: boolean;
  license: boolean;
};

export const NO_VERIFICATION_CAPABILITIES: VerificationAdapterCapabilities = {
  identity: false,
  document: false,
  liveness: false,
  background: false,
  insurance: false,
  license: false,
};

export type VerificationErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "bad_request"
  | "conflict"
  | "evidence_required";

export type VerificationError = {
  code: VerificationErrorCode;
  message: string;
};

export type VerificationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VerificationError };

export type VerificationCase = {
  id: string;
  subject_type: VerificationSubjectType;
  subject_id: string;
  status: VerificationStatus;
  verification_level: VerificationLevel;
  provider: string;
  external_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VerificationEvidence = {
  id: string;
  case_id: string;
  evidence_type: EvidenceType;
  status: EvidenceStatus;
  provider: string;
  external_ref: string | null;
  storage_ref: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  expires_at: string | null;
  rejection_reason: string | null;
};

export type VerificationEvent = {
  id: string;
  case_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor: string | null;
  provider: string | null;
  external_ref: string | null;
  reason: string | null;
  created_at: string;
};

export type PublicTrustSignal = {
  verified: true;
  verificationLevel: VerificationLevel;
  trustBadges: Array<"verified_driver" | "verified_provider" | "identity_verified" | "vehicle_verified">;
};

export type VerificationHealth = {
  provider: VerificationProviderKey;
  status: VerificationProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  last_error: string | null;
  checked_at: string;
};

export type VerificationProviderDescriptor = {
  key: VerificationProviderKey;
  name: string;
  status: VerificationProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  capabilities: VerificationAdapterCapabilities;
  reason: string;
  health: VerificationHealth;
};

export type SafeEvidenceView = {
  id: string;
  evidence_type: EvidenceType;
  status: EvidenceStatus;
  provider: string;
  submitted_at: string;
};
