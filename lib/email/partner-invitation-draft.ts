export type PartnerInvitationDraftInput = {
  businessName: string;
  partnerType: string;
  signupLink: string;
  city?: string | null;
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
    : `SafariPlug partner invitation — ${businessName}`;

  const partnerType = input.partnerType.trim();
  const city = String(input.city || "").trim();

  const opening = provisional
    ? city && partnerType && partnerType !== "Other"
      ? `SafariPlug is expanding its ${partnerType} partner network in ${city}, and we’d like to invite your business to create a supplier profile.`
      : "We’d like to invite you to create a supplier profile on SafariPlug."
    : city && partnerType && partnerType !== "Other"
      ? `SafariPlug is expanding its ${partnerType} partner network in ${city}, and we’d like to invite ${businessName} to join.`
      : `We’d like to invite ${businessName} to create a supplier profile on SafariPlug.`;

  const categoryLine = partnerType && partnerType !== "Other"
    ? `After onboarding and approval, your business can be listed in SafariPlug’s ${partnerType} marketplace so travelers can discover your offering and continue toward booking or enquiry.`
    : "After onboarding and review, SafariPlug will place your business in the appropriate supplier category.";

  const message = [
    "Hello,",
    "",
    opening,
    "",
    "SafariPlug helps travelers discover and book trusted African travel, hospitality and local services in one trip journey.",
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
