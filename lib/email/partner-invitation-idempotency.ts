export function partnerInvitationEmailIdempotencyKey(
  invitationId: string,
  approvedAt?: string | null,
) {
  const id = String(invitationId || "").trim();
  if (!id) throw new Error("Invitation ID is required for email idempotency.");
  const approval = String(approvedAt || "legacy-approved").trim() || "legacy-approved";
  return `partner-invitation/${id}/${approval}`.slice(0, 256);
}
