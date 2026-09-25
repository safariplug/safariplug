export type PostAuthDestinationInput = {
  isAdmin?: boolean;
  isStaff?: boolean;
  next?: string | null;
  accountIntent?: unknown;
  accountType?: unknown;
};

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function safeInternalNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;

  const path = value.split("?")[0].split("#")[0];
  const authEntryPaths = new Set([
    "/login",
    "/admin/login",
    "/staff/login",
    "/account/login",
    "/partner/login",
  ]);

  if (authEntryPaths.has(path)) return null;
  return value;
}

function fallbackDestination(accountIntent: unknown, accountType: unknown) {
  const intent = normalized(accountIntent);
  const type = normalized(accountType);

  if (type === "supplier") return "/supplier/onboarding";
  if (intent === "partner" || intent === "vendor") return "/business/services";
  if (intent === "local") return "/locals/onboarding";
  return "/account";
}

export function postAuthDestination(input: PostAuthDestinationInput) {
  if (input.isAdmin) return "/admin";
  if (input.isStaff) return "/staff";

  const next = safeInternalNext(input.next);
  if (next && !next.startsWith("/admin") && !next.startsWith("/staff")) {
    return next;
  }

  return fallbackDestination(input.accountIntent, input.accountType);
}
