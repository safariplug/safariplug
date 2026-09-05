/**
 * Server-only Aurelian configuration.
 * SAFARIPLUG_AURELIAN_API_KEY is the inbound pull secret Aurelian presents
 * to GET /api/integrations/aurelian/events. It must never be prefixed
 * NEXT_PUBLIC_ or returned to a browser.
 */

export const AURELIAN_PROVIDER = "aurelian";

export const INBOUND_EVENTS_PATH = "/api/integrations/aurelian/events";

/**
 * Outbound REST paths are unknown until Aurelian documents them.
 * Leave these null. Do not invent /experiences or /health URLs.
 */
export const AURELIAN_SYNC_EXPERIENCE_PATH: string | null = null;
export const AURELIAN_GET_EXPERIENCE_PATH: string | null = null;
export const AURELIAN_HEALTH_PATH: string | null = null;

export type AurelianConfig = {
  inboundKeyConfigured: boolean;
  outboundBaseUrl: string | null;
  outboundContractAvailable: boolean;
  outboundBlockedReason: string | null;
};

function readInboundKey(): string | null {
  const value = process.env.SAFARIPLUG_AURELIAN_API_KEY?.trim();
  return value ? value : null;
}

function readOutboundBaseUrl(): string | null {
  const value = process.env.AURELIAN_API_BASE_URL?.trim();
  return value ? value.replace(/\/+$/, "") : null;
}

export function getAurelianConfig(): AurelianConfig {
  const inboundKeyConfigured = Boolean(readInboundKey());
  const outboundBaseUrl = readOutboundBaseUrl();
  const outboundContractAvailable = Boolean(
    outboundBaseUrl && AURELIAN_SYNC_EXPERIENCE_PATH
  );

  let outboundBlockedReason: string | null = null;
  if (!outboundBaseUrl) {
    outboundBlockedReason =
      "AURELIAN_API_BASE_URL is not set. Outbound Aurelian API contract/endpoint is required before live sync.";
  } else if (!AURELIAN_SYNC_EXPERIENCE_PATH) {
    outboundBlockedReason =
      "Aurelian outbound API paths are not documented in this repository. Live sync is disabled until the contract is available.";
  }

  return {
    inboundKeyConfigured,
    outboundBaseUrl,
    outboundContractAvailable,
    outboundBlockedReason,
  };
}

/** Auth header for outbound calls. Never log the return value. */
export function getAurelianAuthHeader(): { "x-api-key": string } | null {
  const key = readInboundKey();
  if (!key) return null;
  return { "x-api-key": key };
}

export function redactSecrets(
  value: Record<string, unknown>
): Record<string, unknown> {
  const blocked = new Set([
    "SAFARIPLUG_AURELIAN_API_KEY",
    "x-api-key",
    "apiKey",
    "api_key",
    "authorization",
  ]);
  const clone: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    clone[key] = blocked.has(key) || blocked.has(key.toLowerCase())
      ? "[redacted]"
      : item;
  }
  return clone;
}
