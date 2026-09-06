import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("service_appointments").select("id,public_id,trip_id,starts_at,ends_at,status,customer_name,customer_email,customer_phone,customer_notes,provider_notes,price,currency,payment_status,cancellation_reason,created_at,service_profiles(id,timezone,cancellation_policy,businesses(name,slug,address,phone,whatsapp)),service_offerings(id,name,description,duration_minutes),service_staff(id,display_name)").eq("customer_user_id", user.id).order("starts_at", { ascending: true }).limit(100);
  if (error) return NextResponse.json({ error: "Unable to load appointments." }, { status: 500 });
  const ids = (data ?? []).map((x: any) => x.id);
  const { data: events } = ids.length ? await supabaseAdmin.from("service_appointment_status_events").select("appointment_id,from_status,to_status,actor_type,note,created_at").in("appointment_id", ids).order("created_at", { ascending: true }) : { data: [] };
  return NextResponse.json({ appointments: data ?? [], events: events ?? [] });
}

async function slotIsAvailable(profileId: string, offeringId: string, startsAt: Date, staffId: string) {
  const profile = await supabaseAdmin.from("service_profiles").select("timezone").eq("id", profileId).maybeSingle();
  if (profile.error || !profile.data) return false;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: profile.data.timezone || "Africa/Nairobi", year:"numeric", month:"2-digit", day:"2-digit" }).format(startsAt);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com";
  const url = `${base}/api/services/availability?serviceProfileId=${encodeURIComponent(profileId)}&offeringId=${encodeURIComponent(offeringId)}&date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(staffId)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return false;
  const payload = await response.json();
  return Array.isArray(payload.slots) && payload.slots.some((slot: any) => slot.staffId === staffId && slot.startsAt === startsAt.toISOString());
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    const body = await request.json();
    const action = String(body.action || "");
    const id = String(body.appointmentId || "");
    if (!id) return NextResponse.json({ error: "Appointment is required." }, { status: 400 });
    const { data: appointment } = await supabaseAdmin.from("service_appointments").select("id,public_id,trip_id,customer_user_id,status,starts_at,ends_at,staff_id,service_profile_id,offering_id,customer_name").eq("id", id).eq("customer_user_id", user.id).maybeSingle();
    if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

    if (action === "add_to_trip") {
      const tripId = String(body.tripId || "");
      if (!tripId) return NextResponse.json({ error: "Journey is required." }, { status: 400 });
      const { data: trip } = await supabaseAdmin.from("trips").select("id,title,traveler_id").eq("id", tripId).eq("traveler_id", user.id).maybeSingle();
      if (!trip) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
      if (["cancelled", "no_show"].includes(appointment.status)) return NextResponse.json({ error: "Cancelled appointments cannot be added to a journey." }, { status: 409 });
      const { data: existing } = await supabaseAdmin.from("trip_items").select("id").eq("trip_id", tripId).eq("booking_id", appointment.id).maybeSingle();
      if (existing) {
        await supabaseAdmin.from("service_appointments").update({ trip_id: tripId, updated_at: new Date().toISOString() }).eq("id", id).eq("customer_user_id", user.id);
        return NextResponse.json({ added: false, trip, itemId: existing.id });
      }
      const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
      const { data: item, error } = await supabaseAdmin.from("trip_items").insert({ trip_id: tripId, booking_id: appointment.id, offering_id: appointment.offering_id, item_kind: "personal_service", position: count ?? 0, start_at: appointment.starts_at, end_at: appointment.ends_at, title: appointment.customer_name ? `Appointment · ${appointment.customer_name}` : "Service appointment" }).select("id,trip_id,booking_id,offering_id,item_kind,position,start_at,end_at,title").single();
      if (error) return NextResponse.json({ error: "Unable to add this appointment to the journey." }, { status: 409 });
      const { error: linkError } = await supabaseAdmin.from("service_appointments").update({ trip_id: tripId, updated_at: new Date().toISOString() }).eq("id", id).eq("customer_user_id", user.id);
      if (linkError) return NextResponse.json({ error: "Journey item created, but booking link could not be saved." }, { status: 500 });
      return NextResponse.json({ added: true, trip, item });
    }

    if (action === "cancel") {
      if (!["pending", "confirmed"].includes(appointment.status)) return NextResponse.json({ error: "This appointment can no longer be cancelled online." }, { status: 409 });
      const { data, error } = await supabaseAdmin.rpc("transition_service_appointment_status", { p_appointment_id: id, p_to_status: "cancelled", p_actor_type: "customer", p_actor_user_id: user.id, p_note: String(body.reason || "Cancelled by customer") });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ appointment: data });
    }

    if (action === "reschedule") {
      if (!["pending", "confirmed"].includes(appointment.status)) return NextResponse.json({ error: "Only pending or confirmed appointments can be rescheduled." }, { status: 409 });
      const startsAt = new Date(String(body.startsAt || ""));
      if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ error: "Choose a valid appointment time." }, { status: 400 });
      const { data: profile } = await supabaseAdmin.from("service_profiles").select("status,booking_status,booking_notice_minutes,max_booking_days").eq("id", appointment.service_profile_id).maybeSingle();
      const { data: offering } = await supabaseAdmin.from("service_offerings").select("duration_minutes,status").eq("id", appointment.offering_id).maybeSingle();
      if (!profile || profile.status !== "active" || profile.booking_status !== "open" || !offering || offering.status !== "active") return NextResponse.json({ error: "This service is not currently accepting reschedules." }, { status: 409 });
      const min = Date.now() + Number(profile.booking_notice_minutes || 0) * 60000;
      const max = Date.now() + Number(profile.max_booking_days || 90) * 86400000;
      if (startsAt.getTime() < min) return NextResponse.json({ error: "That time is inside the provider's booking notice window." }, { status: 409 });
      if (startsAt.getTime() > max) return NextResponse.json({ error: "That time is outside the provider's booking window." }, { status: 409 });
      if (!(await slotIsAvailable(appointment.service_profile_id, appointment.offering_id, startsAt, appointment.staff_id))) return NextResponse.json({ error: "That time is not available. Please choose another live slot." }, { status: 409 });
      const endsAt = new Date(startsAt.getTime() + Number(offering.duration_minutes) * 60000);
      const { data, error } = await supabaseAdmin.from("service_appointments").update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("customer_user_id", user.id).in("status", ["pending", "confirmed"]).select("*").single();
      if (error) return NextResponse.json({ error: error.message.includes("service_appointments_staff_no_overlap") ? "That time is no longer available." : "Unable to reschedule this appointment." }, { status: 409 });
      await supabaseAdmin.from("service_appointment_status_events").insert({ appointment_id: id, from_status: appointment.status, to_status: appointment.status, actor_type: "customer", actor_user_id: user.id, note: `Rescheduled from ${appointment.starts_at} to ${startsAt.toISOString()}` });
      return NextResponse.json({ appointment: data });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("customer appointments", error);
    return NextResponse.json({ error: "Unable to complete appointment action." }, { status: 500 });
  }
}
