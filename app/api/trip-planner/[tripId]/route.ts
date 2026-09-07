import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tripId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { tripId } = await params;
  const { data: trip, error: tripError } = await supabaseAdmin
    .from("trips")
    .select("id,title,destination_city_id,start_on,end_on,status,cover_image_url,created_at,updated_at,cities:destination_city_id(id,name,country,slug)")
    .eq("id", tripId)
    .eq("traveler_id", user.id)
    .maybeSingle();
  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const { data: rawItems, error: itemError } = await supabaseAdmin
    .from("trip_items")
    .select("id,item_kind,title,event_id,offering_id,booking_id,appointment_id,city_id,start_at,end_at,notes,position,created_at,updated_at")
    .eq("trip_id", tripId)
    .order("position", { ascending: true })
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  const eventIds = (rawItems ?? []).map((item) => item.event_id).filter((id): id is string => Boolean(id));
  const appointmentIds = (rawItems ?? []).map((item) => item.appointment_id).filter((id): id is string => Boolean(id));

  const eventsPromise = eventIds.length
    ? supabaseAdmin.from("events").select("id,title,description,category,venue_name,venue_address,start_at,end_at,price,currency,image_url,booking_url,status,verified,latitude,longitude").in("id", eventIds)
    : Promise.resolve({ data: [], error: null });
  const appointmentsPromise = appointmentIds.length
    ? supabaseAdmin.from("service_appointments").select("id,service_profile_id,offering_id,staff_id,starts_at,ends_at,status,price,currency,payment_status,customer_total_amount").eq("customer_user_id", user.id).in("id", appointmentIds)
    : Promise.resolve({ data: [], error: null });

  const [{ data: events, error: eventsError }, { data: appointments, error: appointmentsError }] = await Promise.all([eventsPromise, appointmentsPromise]);
  if (eventsError || appointmentsError) return NextResponse.json({ error: eventsError?.message || appointmentsError?.message }, { status: 500 });

  const eventMap = new Map((events ?? []).map((event) => [event.id, event]));
  const appointmentMap = new Map((appointments ?? []).map((appointment) => [appointment.id, appointment]));

  const items = (rawItems ?? []).map((item) => {
    const event = item.event_id ? eventMap.get(item.event_id) : null;
    const appointment = item.appointment_id ? appointmentMap.get(item.appointment_id) : null;
    return {
      ...item,
      event,
      appointment,
      display_title: item.title || event?.title || (appointment ? "Service appointment" : "Trip item"),
      display_start: item.start_at || event?.start_at || appointment?.starts_at || null,
      display_end: item.end_at || event?.end_at || appointment?.ends_at || null,
    };
  });

  return NextResponse.json({ trip, items });
}
