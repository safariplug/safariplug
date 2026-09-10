import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

async function ownsTrip(userId: string, tripId: string) {
  const { data } = await supabaseAdmin.from("trips").select("id,title").eq("id", tripId).eq("traveler_id", userId).maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const tripId = new URL(request.url).searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  const trip = await ownsTrip(user.id, tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  const { data, error } = await supabaseAdmin.from("trip_items").select("id,trip_id,event_id,appointment_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").eq("trip_id", tripId).order("position").order("start_at", { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], trip });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  const trip = await ownsTrip(user.id, tripId);
  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : null;
  const eventId = typeof body.eventId === "string" ? body.eventId : null;
  const offeringId = typeof body.offeringId === "string" ? body.offeringId : null;
  if (!appointmentId && !eventId && !offeringId) return NextResponse.json({ error: "appointmentId, eventId or offeringId is required." }, { status: 400 });
  if ([appointmentId, eventId, offeringId].filter(Boolean).length > 1) return NextResponse.json({ error: "Choose one trip item type." }, { status: 400 });

  if (appointmentId) {
    const { data: item, error } = await supabaseAdmin.rpc("attach_service_appointment_to_trip", { p_appointment_id: appointmentId, p_trip_id: tripId, p_traveler_id: user.id });
    if (error) {
      if (error.message.includes("appointment_already_in_trip")) return NextResponse.json({ error: "This appointment is already attached to another journey." }, { status: 409 });
      if (error.message.includes("appointment_not_found")) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      if (error.message.includes("trip_not_found")) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
      if (error.message.includes("unauthorized")) return NextResponse.json({ error: "You are not authorized to modify this journey." }, { status: 403 });
      console.error("attach service appointment to trip", error);
      return NextResponse.json({ error: "Unable to add this appointment to the journey." }, { status: 409 });
    }
    const alreadyAttached = Boolean(item?.trip_id === tripId);
    return NextResponse.json({ item, trip, added: !alreadyAttached }, { status: alreadyAttached ? 200 : 201 });
  }

  let event: any = null;
  if (eventId) {
    const { data } = await supabaseAdmin.from("events").select("id,title,city_id,start_at,end_at,status").eq("id", eventId).eq("status", "approved").maybeSingle();
    event = data;
    if (!event) return NextResponse.json({ error: "Approved event not found." }, { status: 404 });
  }

  const matchColumn = eventId ? "event_id" : "offering_id";
  const matchValue = eventId ?? offeringId;
  const { data: existing } = await supabaseAdmin.from("trip_items").select("id,trip_id,appointment_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").eq("trip_id", tripId).eq(matchColumn, matchValue).maybeSingle();
  if (existing) return NextResponse.json({ item: existing, trip, added: false }, { status: 200 });

  const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const payload = {
    trip_id: tripId,
    appointment_id: null,
    event_id: event?.id ?? null,
    offering_id: offeringId,
    item_kind: event ? "event" : "experience",
    position: count ?? 0,
    start_at: event?.start_at ?? (typeof body.startAt === "string" ? body.startAt : null),
    end_at: event?.end_at ?? (typeof body.endAt === "string" ? body.endAt : null),
    title: event?.title ?? (typeof body.title === "string" ? body.title.trim() : null),
    city_id: event?.city_id ?? (typeof body.cityId === "string" ? body.cityId : null),
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("trip_items").insert(payload).select("id,trip_id,appointment_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, trip, added: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const tripId = url.searchParams.get("tripId");
  const itemId = url.searchParams.get("itemId");
  if (!tripId || !itemId) return NextResponse.json({ error: "tripId and itemId are required." }, { status: 400 });
  if (!(await ownsTrip(user.id, tripId))) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const { data: item, error: itemError } = await supabaseAdmin.from("trip_items").select("id,appointment_id").eq("id", itemId).eq("trip_id", tripId).maybeSingle();
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
  if (!item) return NextResponse.json({ error: "Trip item not found." }, { status: 404 });

  if (item.appointment_id) {
    const { data: detached, error } = await supabaseAdmin.rpc("detach_service_appointment_from_trip", { p_item_id: itemId, p_trip_id: tripId, p_traveler_id: user.id });
    if (error) {
      if (error.message.includes("trip_item_not_found")) return NextResponse.json({ error: "Trip item not found." }, { status: 404 });
      if (error.message.includes("appointment_not_found")) return NextResponse.json({ error: "Appointment not found or no longer belongs to this journey." }, { status: 409 });
      console.error("detach service appointment from trip", error);
      return NextResponse.json({ error: "Unable to remove this appointment from the journey." }, { status: 409 });
    }
    return NextResponse.json({ item: detached, deleted: true });
  }

  const { error } = await supabaseAdmin.from("trip_items").delete().eq("id", itemId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
