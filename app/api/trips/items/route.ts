import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tripId = new URL(request.url).searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const { data, error } = await supabaseAdmin.from("trip_items").select("id,trip_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").eq("trip_id", tripId).order("position").order("start_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  if (!eventId && !body.offeringId) return NextResponse.json({ error: "eventId or offeringId is required." }, { status: 400 });
  let event: any = null;
  if (eventId) {
    const { data } = await supabaseAdmin.from("events").select("id,title,city_id,start_at,end_at,status").eq("id", eventId).eq("status", "approved").maybeSingle();
    event = data;
    if (!event) return NextResponse.json({ error: "Approved event not found." }, { status: 404 });
  }
  const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const payload = {
    trip_id: tripId,
    event_id: event?.id ?? null,
    offering_id: typeof body.offeringId === "string" ? body.offeringId : null,
    item_kind: event ? "event" : "experience",
    position: count ?? 0,
    start_at: event?.start_at ?? (typeof body.startAt === "string" ? body.startAt : null),
    end_at: event?.end_at ?? (typeof body.endAt === "string" ? body.endAt : null),
    title: event?.title ?? (typeof body.title === "string" ? body.title.trim() : null),
    city_id: event?.city_id ?? (typeof body.cityId === "string" ? body.cityId : null),
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("trip_items").insert(payload).select("id,trip_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
