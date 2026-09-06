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

  let event: any = null;
  let appointment: any = null;
  if (appointmentId) {
    const { data } = await supabaseAdmin.from("service_appointments").select("id,trip_id,status,starts_at,ends_at,offering_id,service_offerings(name),customer_user_id").eq("id", appointmentId).eq("customer_user_id", user.id).maybeSingle();
    appointment = data;
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    if (["cancelled", "no_show"].includes(appointment.status)) return NextResponse.json({ error: "Cancelled appointments cannot be added to a journey." }, { status: 409 });
  }
  if (eventId) {
    const { data } = await supabaseAdmin.from("events").select("id,title,city_id,start_at,end_at,status").eq("id", eventId).eq("status", "approved").maybeSingle();
    event = data;
    if (!event) return NextResponse.json({ error: "Approved event not found." }, { status: 404 });
  }

  const matchColumn = appointmentId ? "appointment_id" : eventId ? "event_id" : "offering_id";
  const matchValue = appointmentId ?? eventId ?? offeringId;
  const { data: existing } = await supabaseAdmin.from("trip_items").select("id,trip_id,appointment_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").eq("trip_id", tripId).eq(matchColumn, matchValue).maybeSingle();
  if (existing) return NextResponse.json({ item: existing, trip, added: false }, { status: 200 });

  const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const payload = {
    trip_id: tripId,
    appointment_id: appointment?.id ?? null,
    event_id: event?.id ?? null,
    offering_id: appointment ? appointment.offering_id : offeringId,
    item_kind: appointment ? "personal_service" : event ? "event" : "experience",
    position: count ?? 0,
    start_at: appointment?.starts_at ?? event?.start_at ?? (typeof body.startAt === "string" ? body.startAt : null),
    end_at: appointment?.ends_at ?? event?.end_at ?? (typeof body.endAt === "string" ? body.endAt : null),
    title: appointment?.service_offerings?.name ?? event?.title ?? (typeof body.title === "string" ? body.title.trim() : null),
    city_id: event?.city_id ?? (typeof body.cityId === "string" ? body.cityId : null),
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("trip_items").insert(payload).select("id,trip_id,appointment_id,event_id,offering_id,item_kind,position,start_at,end_at,notes,title,city_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (appointmentId) {
    const { error: linkError } = await supabaseAdmin.from("service_appointments").update({ trip_id: tripId, updated_at: new Date().toISOString() }).eq("id", appointmentId).eq("customer_user_id", user.id);
    if (linkError) return NextResponse.json({ error: "Journey item created, but booking link could not be saved." }, { status: 500 });
  }
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
  const { data: item } = await supabaseAdmin.from("trip_items").select("id,appointment_id").eq("id", itemId).eq("trip_id", tripId).maybeSingle();
  if (!item) return NextResponse.json({ error: "Trip item not found." }, { status: 404 });
  const { error } = await supabaseAdmin.from("trip_items").delete().eq("id", itemId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (item.appointment_id) await supabaseAdmin.from("service_appointments").update({ trip_id: null, updated_at: new Date().toISOString() }).eq("id", item.appointment_id).eq("customer_user_id", user.id).eq("trip_id", tripId);
  return NextResponse.json({ deleted: true });
}
