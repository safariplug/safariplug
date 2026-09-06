import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id,title")
    .eq("id", id)
    .eq("traveler_id", user.id)
    .maybeSingle();
  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Journey not found." }, { status: 404 });

  const { data: items, error: itemError } = await supabaseAdmin
    .from("trip_items")
    .select("id,title,start_at,end_at,notes,item_kind,event_id,city_id")
    .eq("trip_id", id)
    .not("start_at", "is", null)
    .order("start_at", { ascending: true });
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  const cityIds = [...new Set((items ?? []).map((item) => item.city_id).filter(Boolean))];
  const { data: cities } = cityIds.length
    ? await supabaseAdmin.from("cities").select("id,name,country").in("id", cityIds)
    : { data: [] };
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city]));
  const stamp = icsDate(new Date().toISOString());

  const events = (items ?? []).flatMap((item) => {
    if (!item.start_at) return [];
    const start = new Date(item.start_at);
    if (Number.isNaN(start.getTime())) return [];
    const rawEnd = item.end_at ? new Date(item.end_at) : new Date(start.getTime() + 60 * 60 * 1000);
    const end = Number.isNaN(rawEnd.getTime()) || rawEnd <= start ? new Date(start.getTime() + 60 * 60 * 1000) : rawEnd;
    const city = item.city_id ? cityMap.get(item.city_id) : null;
    const location = city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : "";
    const description = [item.item_kind === "personal_service" ? "Booked SafariPlug service" : "SafariPlug experience", item.notes || ""].filter(Boolean).join("\n\n");
    return [`BEGIN:VEVENT`, `UID:${item.id}@safariplug.com`, `DTSTAMP:${stamp}`, `DTSTART:${icsDate(start.toISOString())}`, `DTEND:${icsDate(end.toISOString())}`, `SUMMARY:${icsEscape(item.title || "SafariPlug experience")}`, location ? `LOCATION:${icsEscape(location)}` : "", `DESCRIPTION:${icsEscape(description)}`, `URL:https://www.safariplug.com/account/trips/${id}`, "END:VEVENT"].filter(Boolean).join("\r\n");
  });

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SafariPlug//Journey Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(trip.title || "SafariPlug Journey")}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${(trip.title || "safariplug-journey").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "safariplug-journey"}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
