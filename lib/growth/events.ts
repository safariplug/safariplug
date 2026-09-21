export type GrowthEventType =
  | "SEARCH"
  | "PRODUCT_VIEW"
  | "PRODUCT_CLICK"
  | "BOOKING_START"
  | "BOOKING_COMPLETE"
  | "REVENUE";

export type GrowthEventInput = {
  event_id?: string;
  event_type: GrowthEventType;
  occurred_at?: string;
  destination?: string | null;
  category?: string | null;
  product_id?: string | null;
  product_type?: string | null;
  source?: "safariplug-web" | "safariplug.com" | "safariplug-server" | "safariplug-first-party";
  session_reference?: string | null;
  anonymous_reference?: string | null;
  marketing_source?: string | null;
  campaign_id?: string | null;
  creative_id?: string | null;
  post_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  landing_url?: string | null;
  original_url?: string | null;
  metadata?: Record<string, unknown>;
  value?: number | null;
  query?: string | null;
};

const DEFAULT_ENDPOINT = "https://growth.safariplug.com/api/events";

function endpoint() {
  return (process.env.SAFARIPLUG_GROWTH_EVENTS_URL || DEFAULT_ENDPOINT).trim();
}

function secret() {
  return (process.env.SAFARIPLUG_EVENT_SECRET || "").trim();
}

export function growthEventRelayConfigured() {
  return Boolean(endpoint() && secret());
}

export async function emitGrowthEvents(events: GrowthEventInput[]) {
  if (!events.length || !growthEventRelayConfigured()) {
    return { ok: false as const, skipped: true as const, reason: "not_configured" as const };
  }

  const payload = events.map((event) => ({
    ...event,
    event_id: event.event_id || `evt-${crypto.randomUUID()}`,
    occurred_at: event.occurred_at || new Date().toISOString(),
    source: event.source || "safariplug-server",
    environment: "PRODUCTION",
    connection_state: "CONNECTED",
  }));

  try {
    const response = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-safariplug-event-secret": secret(),
        "x-safariplug-environment": "PRODUCTION",
        "x-safariplug-relay": "safariplug-origin",
        "x-safariplug-ingest": "production",
      },
      body: JSON.stringify({ events: payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    const result = await response.json().catch(() => null) as
      | { accepted?: number; rejected?: number; duplicates?: number; live_accepted?: number; errors?: unknown[] }
      | null;

    if (!response.ok) {
      console.warn("growth.events.relay_failed", { status: response.status });
      return { ok: false as const, skipped: false as const, status: response.status };
    }

    return {
      ok: true as const,
      accepted: result?.accepted ?? 0,
      rejected: result?.rejected ?? 0,
      duplicates: result?.duplicates ?? 0,
      liveAccepted: result?.live_accepted ?? 0,
    };
  } catch (error) {
    console.warn("growth.events.relay_unavailable", error instanceof Error ? error.message : "unknown");
    return { ok: false as const, skipped: false as const, status: 0 };
  }
}

export async function emitGrowthEvent(event: GrowthEventInput) {
  return emitGrowthEvents([event]);
}

export function stableGrowthEventId(prefix: string, value: string) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 96);
  return `${prefix}-${safe || "event"}`;
}
