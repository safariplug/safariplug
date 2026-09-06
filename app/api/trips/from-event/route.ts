import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getRequestUser, getSupabaseUserClient } from "@/lib/supabase-user";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const bearerClient = getSupabaseUserClient(request);
  let user = null;

  if (bearerClient.ok) {
    user = await getRequestUser(bearerClient.client);
  } else {
    const client = await createSupabaseServerClient();
    const { data: { user: cookieUser } } = await client.auth.getUser();
    user = cookieUser;
  }

  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) return NextResponse.json({ error: "eventId is required." }, { status: 400 });

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id,title,city_id,start_at,end_at,status")
    .eq("id", eventId)
    .eq("status", "approved")
    .maybeSingle();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from("trips")
    .select("id,title,destination_city_id,start_on,end_on,status")
    .eq("traveler_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let trip = existing;

  if (!trip) {
    const { data: created, error } = await supabaseAdmin
      .from("trips")
      .insert({
        traveler_id: user.id,
        title: "My SafariPlug Journey",
        destination_city_id: event.city_id,
        start_on: event.start_at?.slice(0, 10),
        status: "draft",
      })
      .select("id,title,destination_city_id,start_on,end_on,status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    trip = created;
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("trip_items")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("event_id", event.id)
    .maybeSingle();

  if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 });

  if (duplicate) {
    return NextResponse.json({ trip, added: false, itemId: duplicate.id });
  }

  const { count } = await supabaseAdmin
    .from("trip_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const { data: item, error: itemError } = await supabaseAdmin
    .from("trip_items")
    .insert({
      trip_id: trip.id,
      event_id: event.id,
      item_kind: "event",
      position: count ?? 0,
      title: event.title,
      city_id: event.city_id,
      start_at: event.start_at,
      end_at: event.end_at,
    })
    .select("id")
    .single();

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  return NextResponse.json({ trip, added: true, itemId: item.id }, { status: 201 });
}
