import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tripId: string }> };

async function owner(tripId: string) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) return { client, user: null, trip: null };
  const { data: trip } = await supabaseAdmin.from("trips").select("id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
  return { client, user, trip };
}

export async function POST(request: Request, { params }: Params) {
  const { tripId } = await params;
  const { user, trip } = await owner(tripId);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const kind = typeof body.item_kind === "string" ? body.item_kind : "custom";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "Trip item";
  const startAt = typeof body.start_at === "string" && body.start_at ? body.start_at : null;
  const endAt = typeof body.end_at === "string" && body.end_at ? body.end_at : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null;
  const eventId = typeof body.event_id === "string" ? body.event_id : null;
  const appointmentId = typeof body.appointment_id === "string" ? body.appointment_id : null;
  const offeringId = typeof body.offering_id === "string" ? body.offering_id : null;
  const cityId = typeof body.city_id === "string" ? body.city_id : null;
  const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
  const { data, error } = await supabaseAdmin.from("trip_items").insert({ trip_id: tripId, item_kind: kind, title, start_at: startAt, end_at: endAt, notes, event_id: eventId, appointment_id: appointmentId, offering_id: offeringId, city_id: cityId, position: count ?? 0 }).select().single();
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
  const { error } = await supabaseAdmin.from("trip_items").delete().eq("id", itemId).eq("trip_id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
