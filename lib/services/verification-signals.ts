import type { VerificationCase, VerificationEvidence } from "@/lib/integrations/verification/types";

export function hasApprovedLivenessSignal(
  verificationCase: Pick<VerificationCase, "status" | "provider">,
  evidence: Array<Pick<VerificationEvidence, "evidence_type" | "status">>,
) {
  if (verificationCase.status !== "approved") return false;
  if (verificationCase.provider === "liveness_provider") return true;
  return evidence.some((row) => row.evidence_type === "liveness" && row.status === "accepted");
}
