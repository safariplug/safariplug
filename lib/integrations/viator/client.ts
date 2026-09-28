const SANDBOX_BASE = "https://api.sandbox.viator.com/partner";
const PRODUCTION_BASE = "https://api.viator.com/partner";

export function viatorConfigured() {
  return Boolean(process.env.VIATOR_API_KEY);
}

export function viatorEnvironment() {
  return String(process.env.VIATOR_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
}

export function viatorBookingEnabled() {
  return String(process.env.VIATOR_BOOKING_ENABLED || "").toLowerCase() === "true";
}

function baseUrl() {
  return viatorEnvironment() === "production" ? PRODUCTION_BASE : SANDBOX_BASE;
}

export async function viatorRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; language?: string } = {}
): Promise<T> {
  const key = process.env.VIATOR_API_KEY;
  if (!key) throw new Error("Viator API credentials are not configured.");

  const response = await fetch(baseUrl() + path, {
    method: options.method || "GET",
    headers: {
      "exp-api-key": key,
      "Accept-Language": options.language || "en-US",
      "Accept": "application/json;version=2.0",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : "Viator request failed.";
    const error = new Error(message) as Error & { status?: number; trackingId?: string };
    error.status = response.status;
    error.trackingId = response.headers.get("x-unique-id") || body?.trackingId || undefined;
    throw error;
  }
  return body as T;
}

export type ViatorDestination = {
  destinationId: number;
  name: string;
  type: string;
  parentDestinationId?: number | null;
  lookupId?: string | null;
  defaultCurrencyCode?: string | null;
  timeZone?: string | null;
  iataCode?: string | null;
};

export async function getViatorDestinations() {
  return viatorRequest<ViatorDestination[]>("/destinations");
}

export async function getViatorProduct(productCode: string) {
  return viatorRequest<Record<string, unknown>>(
    "/products/" + encodeURIComponent(productCode.trim()),
    { language: "en-US" }
  );
}
