export const NON_APPOINTMENT_SUPPLIER_TYPES = new Set([
  "restaurant",
  "hotel",
  "event organizer",
]);

export function isAppointmentProviderBusinessType(
  businessType: string | null | undefined,
  hasServiceProfile: boolean,
) {
  const normalized = String(businessType || "").trim().toLowerCase();
  if (normalized) return !NON_APPOINTMENT_SUPPLIER_TYPES.has(normalized);
  return hasServiceProfile;
}


export function canSubmitSupplierOnboarding({
  locked,
  submitted,
  ready,
}: {
  locked: boolean;
  submitted: boolean;
  ready: boolean;
}) {
  return !locked && !submitted && ready;
}


export function supplierNextAction({
  onboardingStatus,
  readinessReady,
  readinessIssues,
  reviewItems,
}: {
  onboardingStatus: string;
  readinessReady: boolean;
  readinessIssues: { key: string; label: string; href: string }[];
  reviewItems?: string[] | null;
}) {
  if (onboardingStatus === "submitted") {
    return {
      title: "Waiting for SafariPlug review",
      detail: "Your onboarding has been submitted. SafariPlug staff will review the completed activation requirements.",
      href: null as string | null,
      cta: null as string | null,
    };
  }

  if (onboardingStatus === "changes_requested" && reviewItems?.length) {
    const key = reviewItems[0];
    const issue = readinessIssues.find((item) => item.key === key);
    return {
      title: issue?.label || "Complete the first requested change",
      detail: `${reviewItems.length} requested change${reviewItems.length === 1 ? "" : "s"} remain before you can resubmit.`,
      href: issue?.href || "/supplier/onboarding",
      cta: "Fix requested change",
    };
  }

  if (!readinessReady && readinessIssues.length) {
    const issue = readinessIssues[0];
    return {
      title: issue.label,
      detail: `${readinessIssues.length} activation step${readinessIssues.length === 1 ? "" : "s"} remaining. Complete this one next.`,
      href: issue.href,
      cta: "Fix this next",
    };
  }

  if (readinessReady) {
    return {
      title: "Submit for SafariPlug review",
      detail: "All activation requirements are complete. Submit your profile for staff review.",
      href: "#submit-for-review",
      cta: "Go to submit",
    };
  }

  return {
    title: "Continue your supplier setup",
    detail: "Complete your business profile to unlock the next onboarding step.",
    href: "#business-details",
    cta: "Continue setup",
  };
}
