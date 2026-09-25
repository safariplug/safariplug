import { NextResponse } from "next/server";
import { emitGrowthEvent, growthEventRelayConfigured, type GrowthEventInput } from "@/lib/growth/events";

export const dynamic = "force-dynamic";

const CLIENT_TYPES = new Set(["SEARCH", "PRODUCT_VIEW", "PRODUCT_CLICK", "BOOKING_START"]);

function text(value: unknown, max = 240) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const allowed = [
    "booking_context",
    "booking_step",
    "provider",
    "check_in",
    "check_out",
    "rooms",
    "guests",
    "result_count",
    "filter",
    "click_target",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const entry = raw[key];
    if (typeof entry === "string") out[key] = entry.slice(0, 180);
    else if (typeof entry === "number" || typeof entry === "boolean") out[key] = entry;
  }
  return out;
}

export async function GET() {
  const configured = growthEventRelayConfigured();
  const rawEndpoint = (process.env.SAFARIPLUG_GROWTH_EVENTS_URL || "https://growth.safariplug.com/api/events").trim();

  let endpointHost: string | null = null;
  try {
    endpointHost = new URL(rawEndpoint).host;
  } catch {
    endpointHost = null;
  }

  return NextResponse.json({
    ok: true,
    relay: "safariplug-growth-events",
    configured,
    secret_configured: Boolean((process.env.SAFARIPLUG_EVENT_SECRET || "").trim()),
    endpoint_configured: Boolean(rawEndpoint),
    endpoint_host: endpointHost,
    expected_endpoint_host: "growth.safariplug.com",
    browser_secret_exposed: false,
  });
}

export async function POST(request: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const eventType = String(raw.event_type || "").toUpperCase();
  if (!CLIENT_TYPES.has(eventType)) {
    return NextResponse.json({ ok: false, error: "unsupported_client_event" }, { status: 400 });
  }

  const event: GrowthEventInput = {
    event_type: eventType as GrowthEventInput["event_type"],
    event_id: text(raw.event_id, 140) || undefined,
    destination: text(raw.destination),
    category: text(raw.category),
    product_id: text(raw.product_id, 180),
    product_type: text(raw.product_type, 80),
    source: "safariplug-web",
    session_reference: text(raw.session_reference, 180),
    anonymous_reference: text(raw.anonymous_reference, 180),
    marketing_source: text(raw.marketing_source, 120),
    campaign_id: text(raw.campaign_id, 140),
    creative_id: text(raw.creative_id, 140),
    post_id: text(raw.post_id, 140),
    utm_source: text(raw.utm_source, 120),
    utm_medium: text(raw.utm_medium, 120),
    utm_campaign: text(raw.utm_campaign, 160),
    utm_content: text(raw.utm_content, 160),
    landing_url: text(raw.landing_url, 500),
    original_url: text(raw.original_url, 500),
    metadata: safeMetadata(raw.metadata),
    query: text(raw.query, 240),
  };

  const result = await emitGrowthEvent(event);
  return NextResponse.json(
    { ok: result.ok, relayed: !("skipped" in result && result.skipped) },
    { status: result.ok || ("skipped" in result && result.skipped) ? 200 : 202 },
  );
}
