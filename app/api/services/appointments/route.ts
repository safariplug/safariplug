import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { sendExpoPushNotifications } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

function formatBookingTime(value: string, timezone: string) {
  try { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "UTC" }).format(new Date(value)); }
  catch { return new Date(value).toLocaleString("en-GB"); }
}

async function notifySupplier(params: { serviceProfileId: string; offeringId: string; customerName: string; customerEmail?: string | null; customerPhone?: string | null; startsAt: string }) {
  const { data: profile } = await supabaseAdmin.from("service_profiles").select("id,notification_email,notification_whatsapp,timezone,business_id").eq("id", params.serviceProfileId).maybeSingle();
  if (!profile) return { push: 0, email: false, whatsapp: false, whatsappFallbackUrl: null };
  const [{ data: business }, { data: offering }, { data: supplier }] = await Promise.all([
    supabaseAdmin.from("businesses").select("name,phone,whatsapp,email").eq("id", profile.business_id).maybeSingle(),
    supabaseAdmin.from("service_offerings").select("name").eq("id", params.offeringId).maybeSingle(),
    supabaseAdmin.from("supplier_accounts").select("user_id").eq("business_id", profile.business_id).maybeSingle(),
  ]);
  const businessName = business?.name || "Your SafariPlug business";
  const serviceName = offering?.name || "Service";
  const when = formatBookingTime(params.startsAt, profile.timezone || "UTC");
  const message = [`New SafariPlug booking — ${businessName}`, `Service: ${serviceName}`, `When: ${when}`, `Customer: ${params.customerName}`, params.customerPhone ? `Phone: ${params.customerPhone}` : null, params.customerEmail ? `Email: ${params.customerEmail}` : null, "Open SafariPlug to manage this booking."].filter(Boolean).join("\n");
  let push = 0;
  if (supplier?.user_id) {
    const { data: tokens } = await supabaseAdmin.from("push_notification_tokens").select("expo_push_token").eq("user_id", supplier.user_id).eq("enabled", true);
    if (tokens?.length) {
      const result = await sendExpoPushNotifications(tokens.map((row) => row.expo_push_token), { title: `New booking · ${serviceName}`, body: `${params.customerName} booked ${when}. Tap to manage it.`, data: { type: "service_booking", serviceProfileId: params.serviceProfileId } });
      push = result.sent;
    }
  }
  let email = false;
  if (profile.notification_email && business?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>", to: business.email, subject: `New SafariPlug booking — ${serviceName}`, text: message });
    email = !result.error;
    if (result.error) console.error("Supplier booking email failed", result.error);
  }
  let whatsapp = false;
  let whatsappFallbackUrl: string | null = null;
  if (profile.notification_whatsapp) {
    const result = await sendWhatsAppMessage(business?.whatsapp || business?.phone, message);
    whatsapp = result.sent;
    whatsappFallbackUrl = result.fallbackUrl;
  }
  return { push, email, whatsapp, whatsappFallbackUrl };
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    for (const k of ["serviceProfileId", "offeringId", "staffId", "customerName", "startsAt"]) if (!b[k]) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    if (!b.customerEmail && !b.customerPhone) return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    let customerUserId: string | null = null;
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (request.headers.get("x-safariplug-concierge") === "1") {
      if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return NextResponse.json({ error: "A verified SafariPlug client account is required for Concierge bookings." }, { status: 401 });
      customerUserId = user.id;
    } else if (user && !user.is_anonymous && (user.email_confirmed_at || user.phone_confirmed_at)) customerUserId = user.id;
    const tripId = typeof b.tripId === "string" && b.tripId.trim() ? b.tripId.trim() : null;
    if (tripId && !customerUserId) return NextResponse.json({ error: "Sign in to attach a booking to a journey." }, { status: 401 });
    const { data: appointment, error } = await supabaseAdmin.rpc("create_service_appointment", { p_service_profile_id: b.serviceProfileId, p_offering_id: b.offeringId, p_staff_id: b.staffId, p_customer_user_id: customerUserId, p_customer_name: b.customerName, p_customer_email: b.customerEmail ?? null, p_customer_phone: b.customerPhone ?? null, p_starts_at: b.startsAt, p_customer_notes: b.customerNotes ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("slot_unavailable") ? 409 : 400 });
    let attachedToTrip = false;
    let tripAttachmentError: string | null = null;
    if (tripId && customerUserId && appointment?.id) {
      const { error: attachError } = await supabaseAdmin.rpc("attach_service_appointment_to_trip", { p_appointment_id: appointment.id, p_trip_id: tripId, p_traveler_id: customerUserId });
      if (attachError) {
        tripAttachmentError = attachError.message;
        console.error("Trip attachment failed after service booking creation", { appointmentId: appointment.id, tripId, error: attachError });
      } else {
        attachedToTrip = true;
      }
    }
    let notifications = { push: 0, email: false, whatsapp: false, whatsappFallbackUrl: null as string | null };
    try {
      notifications = await notifySupplier({ serviceProfileId: b.serviceProfileId, offeringId: b.offeringId, customerName: b.customerName, customerEmail: b.customerEmail ?? null, customerPhone: b.customerPhone ?? null, startsAt: b.startsAt });
    } catch (notificationError) {
      console.error("Supplier booking notification failed after booking creation", notificationError);
    }
    return NextResponse.json({ appointment, customerLinked: Boolean(customerUserId), attachedToTrip, tripAttachmentError, notifications }, { status: 201 });
  } catch (error) {
    console.error("Create service appointment failed", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
