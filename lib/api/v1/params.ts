export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
export const MAX_QUERY_LENGTH = 80;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DateMode = "valid" | "upcoming" | "tonight" | "this-weekend" | "all";

export class ParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParamError";
  }
}

export function parsePage(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_PAGE;
  if (!/^[0-9]+$/.test(raw)) {
    throw new ParamError("page must be a positive integer.");
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new ParamError("page must be a positive integer.");
  }
  return value;
}

export function parseLimit(raw: string | null): number {
  if (raw == null || raw === "") return DEFAULT_LIMIT;
  if (!/^[0-9]+$/.test(raw)) {
    throw new ParamError("limit must be an integer between 1 and 50.");
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw new ParamError("limit must be an integer between 1 and 50.");
  }
  return value;
}

export function parseDateMode(raw: string | null): DateMode {
  if (raw == null || raw === "") return "valid";
  const value = raw.trim().toLowerCase();
  if (
    value === "valid" ||
    value === "upcoming" ||
    value === "tonight" ||
    value === "this-weekend" ||
    value === "all"
  ) {
    return value;
  }
  throw new ParamError(
    "when must be one of valid, upcoming, tonight, this-weekend, all."
  );
}

export function parseFeatured(raw: string | null): boolean | undefined {
  if (raw == null || raw === "") return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new ParamError("featured must be true or false.");
}

export function parseBoundedText(
  raw: string | null,
  field: string,
  max = MAX_QUERY_LENGTH
): string | undefined {
  if (raw == null) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.length > max) {
    throw new ParamError(`${field} must be at most ${max} characters.`);
  }
  return value;
}

export function parseRequiredQuery(raw: string | null): string {
  const value = parseBoundedText(raw, "q");
  if (!value) {
    throw new ParamError("q is required.");
  }
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Strip PostgREST or-filter metacharacters from user text. */
export function sanitizeIlike(value: string): string {
  return value
    .replace(/[%_,*()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function paginationRange(page: number, limit: number): {
  from: number;
  to: number;
} {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
}
