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
  readinessIssues: { key: string; label: string; href: string; owner?: "supplier" | "platform" }[];
  reviewItems?: string[] | null;
}) {
  if (onboardingStatus === "submitted") {
    return {
      title: "Waiting for SafariPlug review",
      detail: "Your onboarding has been submitted and is locked while SafariPlug staff review it. If changes are needed, we will reopen the profile for you.",
      href: null as string | null,
      cta: null as string | null,
    };
  }

  if (["approved", "live"].includes(onboardingStatus)) {
    return {
      title: "You are live on SafariPlug",
      detail: "SafariPlug approved your supplier profile and activated your business for customers.",
      href: "/supplier",
      cta: "Open supplier portal",
    };
  }

  if (onboardingStatus === "rejected") {
    return {
      title: "Application closed",
      detail: "This supplier application is currently closed. Your saved profile has not been deleted.",
      href: null as string | null,
      cta: null as string | null,
    };
  }

  const supplierIssues = readinessIssues.filter((item) => item.owner !== "platform");
  const platformIssues = readinessIssues.filter((item) => item.owner === "platform");

  if (onboardingStatus === "changes_requested" && reviewItems?.length) {
    const key = reviewItems[0];
    const issue = readinessIssues.find((item) => item.key === key);
    if (issue?.owner === "platform") {
      return {
        title: "SafariPlug setup is pending",
        detail: "This requested item depends on SafariPlug configuration. You do not need to fix the platform setup yourself.",
        href: null as string | null,
        cta: null as string | null,
      };
    }
    return {
      title: issue?.label || "Complete the first requested change",
      detail: `${reviewItems.length} requested change${reviewItems.length === 1 ? "" : "s"} remain before you can resubmit.`,
      href: issue?.href || "/supplier/onboarding",
      cta: "Fix requested change",
    };
  }

  if (onboardingStatus === "changes_requested") {
    return {
      title: "Review SafariPlug's requested changes",
      detail: "SafariPlug reopened your profile for updates. Review the staff note, make the requested changes, then resubmit.",
      href: "/supplier/onboarding",
      cta: "Review requested changes",
    };
  }

  if (!readinessReady && supplierIssues.length) {
    const issue = supplierIssues[0];
    return {
      title: issue.label,
      detail: `${supplierIssues.length} supplier action${supplierIssues.length === 1 ? "" : "s"} remaining. Complete this one next.`,
      href: issue.href,
      cta: "Fix this next",
    };
  }

  if (!readinessReady && platformIssues.length) {
    return {
      title: "Waiting on SafariPlug",
      detail: "Your supplier-owned steps are complete. SafariPlug must finish the remaining platform setup before activation can proceed.",
      href: null as string | null,
      cta: null as string | null,
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
