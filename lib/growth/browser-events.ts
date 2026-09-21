"use client";

type BrowserGrowthEvent = {
  event_type: "SEARCH" | "PRODUCT_VIEW" | "PRODUCT_CLICK" | "BOOKING_START";
  event_id?: string;
  destination?: string | null;
  category?: string | null;
  product_id?: string | null;
  product_type?: string | null;
  marketing_source?: string | null;
  campaign_id?: string | null;
  creative_id?: string | null;
  post_id?: string | null;
  landing_url?: string | null;
  original_url?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  query?: string | null;
};

function getSessionReference() {
  if (typeof window === "undefined") return null;
  const key = "safariplug:growth:session";
  let value = window.sessionStorage.getItem(key);
  if (!value) {
    value = window.crypto.randomUUID();
    window.sessionStorage.setItem(key, value);
  }
  return value;
}

function getAnonymousReference() {
  if (typeof window === "undefined") return null;
  const key = "safariplug:growth:anon";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = window.crypto.randomUUID();
    window.localStorage.setItem(key, value);
  }
  return value;
}

function attribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
  };
}

export async function emitBrowserGrowthEvent(event: BrowserGrowthEvent) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/growth/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...event,
        ...attribution(),
        session_reference: getSessionReference(),
        anonymous_reference: getAnonymousReference(),
        landing_url: event.landing_url || window.location.href,
        original_url: event.original_url || window.location.href,
      }),
      keepalive: true,
    });
  } catch {
    // Growth telemetry must never interrupt the customer journey.
  }
}
