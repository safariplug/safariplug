export type PartnerInvitationDraftInput = {
  businessName: string;
  partnerType: string;
  signupLink: string;
};

export type PartnerInvitationDraft = {
  subject: string;
  message: string;
};

export function deterministicPartnerInvitationDraft(input: PartnerInvitationDraftInput): PartnerInvitationDraft {
  const businessName = input.businessName.trim();
  const provisional = businessName === "Invited supplier";
  const subject = provisional
    ? "Invitation to join SafariPlug"
    : `Invitation to join SafariPlug — ${businessName}`;

  const opening = provisional
    ? "We’d like to invite you to create a supplier profile on SafariPlug."
    : `We’d like to invite ${businessName} to create a supplier profile on SafariPlug.`;

  const partnerType = input.partnerType.trim();
  const categoryLine = partnerType && partnerType !== "Other"
    ? `SafariPlug would list your business in the ${partnerType} category after onboarding and approval.`
    : "SafariPlug will place your business in the appropriate supplier category after onboarding and review.";

  const message = [
    "Hello,",
    "",
    opening,
    "",
    "SafariPlug helps travelers discover and book trusted African travel, hospitality and local services.",
    categoryLine,
    "",
    "You control your profile, offerings, rates and availability. Signing up does not automatically verify or activate your business; SafariPlug onboarding and review still apply before anything becomes live.",
    "",
    "Complete your supplier setup here:",
    input.signupLink,
    "",
    "SafariPlug Partner Team",
  ].join("\n");

  return { subject, message };
}
