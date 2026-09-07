export const ADMIN_ROLES = [
  "super_admin",
  "operations_admin",
  "curation_manager",
  "marketing_manager",
  "finance_manager",
  "support_manager",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | "dashboard"
  | "staff"
  | "operations"
  | "curation"
  | "marketing"
  | "finance"
  | "support";

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  curation_manager: "Curation Manager",
  marketing_manager: "Marketing Manager",
  finance_manager: "Finance Manager",
  support_manager: "Support Manager",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Full SafariPlug administration and staff management.",
  operations_admin: "Events, bookings, partners, transfers, hotels and driver operations.",
  curation_manager: "AI Scout, discovery review, event curation and publishing.",
  marketing_manager: "Marketing Studio, campaigns, creative and publishing.",
  finance_manager: "Sales, payouts, provider economics and financial operations.",
  support_manager: "Customer support and booking-related operational access.",
};

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ["dashboard", "staff", "operations", "curation", "marketing", "finance", "support"],
  operations_admin: ["dashboard", "operations", "support"],
  curation_manager: ["dashboard", "curation"],
  marketing_manager: ["dashboard", "marketing"],
  finance_manager: ["dashboard", "finance"],
  support_manager: ["dashboard", "support"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function roleHasPermission(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionForPath(pathname: string): AdminPermission {
  if (pathname === "/admin/staff" || pathname.startsWith("/admin/staff/") || pathname === "/api/admin/staff") {
    return "staff";
  }

  if (pathname.startsWith("/admin/marketing") || pathname.startsWith("/api/admin/marketing")) {
    return "marketing";
  }

  if (
    pathname.startsWith("/admin/ai-events") ||
    pathname.startsWith("/admin/ai-scout") ||
    pathname.startsWith("/api/admin/ai-events") ||
    pathname.startsWith("/api/admin/ai-scout") ||
    pathname.startsWith("/admin/events") ||
    pathname.startsWith("/api/admin/events")
  ) {
    return "curation";
  }

  if (
    pathname.startsWith("/admin/payouts") ||
    pathname.startsWith("/admin/ai-sales") ||
    pathname.startsWith("/api/admin/payouts") ||
    pathname.startsWith("/api/admin/sales")
  ) {
    return "finance";
  }

  if (
    pathname.startsWith("/admin/integrations") ||
    pathname.startsWith("/admin/drivers") ||
    pathname.startsWith("/admin/partners") ||
    pathname.startsWith("/api/admin/integrations") ||
    pathname.startsWith("/api/admin/drivers") ||
    pathname.startsWith("/api/admin/partners")
  ) {
    return "operations";
  }

  if (
    pathname.startsWith("/admin/support") ||
    pathname.startsWith("/api/admin/support") ||
    pathname.startsWith("/admin/bookings") ||
    pathname.startsWith("/api/admin/bookings")
  ) {
    return "support";
  }

  return "dashboard";
}
