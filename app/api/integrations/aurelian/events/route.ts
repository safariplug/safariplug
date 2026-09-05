import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateIntegrationKey } from "@/lib/integrations/api-key";

const SAFARIPLUG_ORIGIN = "https://www.safariplug.com";
const PAGE_SIZE = 500;

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

async function loadApprovedUpcomingEvents() {
  const now = new Date().toISOString();
  const allEvents: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("events")
      .select(
        "id, title, description, category, venue_name, venue_address, start_at, end_at, price, currency, image_url, booking_url, source_url, organizer_name, is_featured, verified, status, city_id, cities(id, name, country)"
      )
      .eq("status", "approved")
      .gte("start_at", now)
      .order("start_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    allEvents.push(...(data as Array<Record<string, unknown>>));
    if (data.length < PAGE_SIZE) break;
  }

  return allEvents;
}

export async function GET(request: Request) {
  if (!validateIntegrationKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = await loadApprovedUpcomingEvents();

    const experiences = events.map((event) => {
      // Aurelian's canonical click-through stays on SafariPlug so the
      // discovery relationship is preserved. booking_url remains metadata.
      const bookingUrl = absoluteHttpsUrl(event.booking_url);
      const canonicalUrl =
        `${SAFARIPLUG_ORIGIN}/events/${encodeURIComponent(String(event.id))}`;

      return {
        ...event,
        booking_url: bookingUrl,
        url: canonicalUrl,
        canonical_url: canonicalUrl,
      };
    });

    return NextResponse.json({
      source: "SafariPlug",
      count: experiences.length,
      experiences,
    });
  } catch (error) {
    console.error("AURELIAN EVENTS FEED ERROR:", error);
    return NextResponse.json(
      { error: "Could not load SafariPlug experiences" },
      { status: 500 }
    );
  }
}
