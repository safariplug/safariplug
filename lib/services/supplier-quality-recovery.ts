export type SupplierQualityIssueKind =
  | "bookings_closed"
  | "no_valid_offering"
  | "no_active_specialist"
  | "no_active_availability"
  | "high_cancel_no_show";

export type SupplierQualityRecovery = {
  kind: SupplierQualityIssueKind;
  title: string;
  priority: "normal" | "high";
  dueHours: number;
  note: string;
};

export function supplierQualityRecovery(kind: SupplierQualityIssueKind, detail?: string): SupplierQualityRecovery {
  if (kind === "bookings_closed") {
    return {
      kind,
      title: "[Supplier quality] Reopen supplier bookings",
      priority: "high",
      dueHours: 24,
      note: detail || "The supplier profile is active but customer bookings are closed. Confirm whether this is intentional; otherwise help the supplier restore bookability.",
    };
  }
  if (kind === "no_valid_offering") {
    return {
      kind,
      title: "[Supplier quality] Fix active offering",
      priority: "high",
      dueHours: 24,
      note: detail || "The supplier has no valid active offering with both a positive price and service duration. Review the storefront and help correct the catalog.",
    };
  }
  if (kind === "no_active_specialist") {
    return {
      kind,
      title: "[Supplier quality] Restore active specialist",
      priority: "high",
      dueHours: 24,
      note: detail || "The supplier has no active specialist. Confirm staffing status before leaving bookings open.",
    };
  }
  if (kind === "no_active_availability") {
    return {
      kind,
      title: "[Supplier quality] Restore supplier availability",
      priority: "normal",
      dueHours: 48,
      note: detail || "Active specialists have no active availability. Review whether the supplier has temporarily paused service or needs help reopening availability.",
    };
  }
  return {
    kind,
    title: "[Supplier quality] Review cancellations and no-shows",
    priority: "high",
    dueHours: 24,
    note: detail || "The supplier has an elevated recent cancellation/no-show rate. Review appointment history and contact the supplier if operational recovery is needed.",
  };
}

export function supplierQualityDueAt(recovery: SupplierQualityRecovery, nowMs = Date.now()) {
  return new Date(nowMs + recovery.dueHours * 60 * 60 * 1000).toISOString();
}
