import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tripId: string }> };

async function owner(tripId: string) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) return { user: null, trip: null };
  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  return { user, trip };
}

export async function POST(request: Request, { params }: Params) {
  const { tripId } = await params;
  const { user, trip } = await owner(tripId);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id : null;
  if (appointmentId) {
    const { data, error } = await supabaseAdmin.rpc("attach_service_appointment_to_trip", { p_appointment_id: appointmentId, p_trip_id: tripId, p_traveler_id: user.id });
    if (error) {
      if (error.message.includes("appointment_already_in_trip")) return NextResponse.json({ error: "This appointment is already attached to another journey." }, { status: 409 });
      if (error.message.includes("appointment_not_found")) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      if (error.message.includes("trip_not_found")) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      console.error("attach service appointment to trip", error);
      return NextResponse.json({ error: "Unable to add this appointment to the journey." }, { status: 409 });
    }
    return NextResponse.json({ item: data }, { status: 201 });
  }

  const kind = typeof body.item_kind === "string" ? body.item_kind : "custom";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "Trip item";
  const startAt = typeof body.start_at === "string" && body.start_at ? body.start_at : null;
  const endAt = typeof body.end_at === "string" && body.end_at ? body.end_at : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;
  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  const offeringId = typeof body.offering_id === "string" ? body.offering_id : null;
  const cityId = typeof body.city_id === "string" ? body.city_id : null;
  const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const { data, error } = await supabaseAdmin.from("trip_items").insert({ trip_id: tripId, item_kind: kind, title, start_at: startAt, end_at: endAt, notes, event_id: eventId, appointment_id: null, offering_id: offeringId, city_id: cityId, position: count ?? 0 }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: Params) {
  const { tripId } = await params;
  const { user, trip } = await owner(tripId);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.item_id !== "string") return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const key of ["title", "start_at", "end_at", "notes", "item_kind", "position", "city_id"]) if (key in body) updates[key] = body[key];
  const { data, error } = await supabaseAdmin.from("trip_items").update(updates).eq("id", body.item_id).eq("trip_id", tripId).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Itinerary item not found" }, { status: 404 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request, { params }: Params) {
  const { tripId } = await params;
  const { user, trip } = await owner(tripId);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const itemId = new URL(request.url).searchParams.get("item_id");
  if (!itemId) return NextResponse.json({ error: "item_id is required" }, { status: 400 });

  const { data: item } = await supabaseAdmin.from("trip_items").select("id,appointment_id").eq("id", itemId).eq("trip_id", tripId).maybeSingle();
  if (!item) return NextResponse.json({ error: "Itinerary item not found" }, { status: 404 });
  if (item.appointment_id) {
    const { error } = await supabaseAdmin.rpc("detach_service_appointment_from_trip", { p_item_id: itemId, p_trip_id: tripId, p_traveler_id: user.id });
    if (error) {
      if (error.message.includes("appointment_not_found")) return NextResponse.json({ error: "Appointment not found or no longer belongs to this journey." }, { status: 409 });
      if (error.message.includes("trip_item_not_found")) return NextResponse.json({ error: "Itinerary item not found" }, { status: 404 });
      console.error("detach service appointment from trip", error);
      return NextResponse.json({ error: "Unable to remove this appointment from the journey." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin.from("trip_items").delete().eq("id", itemId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
