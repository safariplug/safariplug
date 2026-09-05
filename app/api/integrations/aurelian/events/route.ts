import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateIntegrationKey } from "@/lib/integrations/api-key";

const SAFARIPLUG_ORIGIN = "https://www.safariplug.com";
const PAGE_SIZE = 500;

type FeedEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  venue_name: string | null;
  venue_address: string | null;
  start_at: string | null;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  source_url: string | null;
  organizer_name: string | null;
  is_featured: boolean | null;
  verified: boolean | null;
  status: string;
  city_id: string | null;
  cities: unknown;
};

type FeedExperience = FeedEvent & {
  booking_url: string | null;
  url: string;
  canonical_url: string;
};

function absoluteHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function recordFeedRun(input: {
  requestedAt: string;
  durationMs: number;
  httpStatus: number;
  recordCount: number;
  upcomingCount: number;
  excludedPastCount: number;
  malformedCount: number;
  outcome: "success" | "error";
}) {
  try {
    await supabaseAdmin.from("aurelian_feed_runs").insert({
      provider: "aurelian",
      requested_at: input.requestedAt,
      duration_ms: input.durationMs,
      http_status: input.httpStatus,
      record_count: input.recordCount,
      upcoming_count: input.upcomingCount,
      excluded_past_count: input.excludedPastCount,
      malformed_count: input.malformedCount,
      outcome: input.outcome,
    });
  } catch (error) {
    // Telemetry must never make the partner feed fail.
    console.error("AURELIAN FEED TELEMETRY ERROR:", error);
  }
}

async function loadApprovedUpcomingEvents(): Promise<FeedEvent[]> {
  const now = new Date().toISOString();
  const allEvents: FeedEvent[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select(
        "id, title, description, category, venue_name, venue_address, start_at, end_at, price, currency, image_url, booking_url, source_url, organizer_name, is_featured, verified, status, city_id, cities(id, name, country)",
      )
      .eq("status", "approved")
      .gte("start_at", now)
      .order("start_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    allEvents.push(...(data as unknown as FeedEvent[]));
    if (data.length < PAGE_SIZE) break;
  }

  return allEvents;
}

export async function GET(request: Request) {
  if (!validateIntegrationKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedAt = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const events = await loadApprovedUpcomingEvents();

    const experiences: FeedExperience[] = events.map((event) => {
      // Aurelian's canonical click-through stays on SafariPlug so the
      // discovery relationship is preserved. booking_url remains metadata.
      const bookingUrl = absoluteHttpsUrl(event.booking_url);
      const canonicalUrl =
        `${SAFARIPLUG_ORIGIN}/events/${encodeURIComponent(event.id)}`;

      return {
        ...event,
        booking_url: bookingUrl,
        url: canonicalUrl,
        canonical_url: canonicalUrl,
      };
    });

    const malformedCount = experiences.filter(
      (experience) =>
        !experience.id ||
        typeof experience.title !== "string" ||
        !experience.title.trim(),
    ).length;
    const durationMs = Date.now() - startedAt;

    await recordFeedRun({
      requestedAt,
      durationMs,
      httpStatus: 200,
      recordCount: experiences.length,
      upcomingCount: experiences.length,
      excludedPastCount: 0,
      malformedCount,
      outcome: "success",
    });

    return NextResponse.json({
      source: "SafariPlug",
      count: experiences.length,
      experiences,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await recordFeedRun({
      requestedAt,
      durationMs,
      httpStatus: 500,
      recordCount: 0,
      upcomingCount: 0,
      excludedPastCount: 0,
      malformedCount: 0,
      outcome: "error",
    });
    console.error("AURELIAN EVENTS FEED ERROR:", error);
    return NextResponse.json(
      { error: "Could not load SafariPlug experiences" },
      { status: 500 },
    );
  }
}
