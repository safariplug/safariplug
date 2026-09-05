import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateIntegrationKey } from "@/lib/integrations/api-key";

const SAFARIPLUG_ORIGIN = "https://www.safariplug.com";

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

export async function GET(request: Request) {
  if (!validateIntegrationKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: events, error } = await supabaseAdmin
    .from("events")
    .select(
      "id, title, description, category, venue_name, start_at, end_at, price, currency, image_url, booking_url, cities(name)"
    )
    .eq("status", "approved")
    .order("start_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const experiences = (events ?? []).map((event) => {
    const bookingUrl = absoluteHttpsUrl(event.booking_url);
    const canonicalUrl =
      bookingUrl ?? `${SAFARIPLUG_ORIGIN}/events/${encodeURIComponent(event.id)}`;

    return {
      ...event,
      url: canonicalUrl,
      canonical_url: canonicalUrl,
    };
  });

  return NextResponse.json({
    source: "SafariPlug",
    count: experiences.length,
    experiences,
  });
}
