import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRequestUser, getSupabaseUserClient } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ready = getSupabaseUserClient(request);
  if (!ready.ok) return NextResponse.json({ success: false, error: { code: "unauthorized", message: "Sign in with a confirmed SafariPlug account." } }, { status: 401 });
  const user = await getRequestUser(ready.client);
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ success: false, error: { code: "unauthorized", message: "A confirmed SafariPlug account is required." } }, { status: 401 });
  }
  try {
    const body = await request.json();
    const serviceProfileId = String(body.serviceProfileId || "");
    const offeringId = String(body.offeringId || "");
    const staffId = String(body.staffId || "");
    const startsAt = String(body.startsAt || "");
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const customerEmail = String(body.customerEmail || user.email || "").trim();
    const customerNotes = String(body.customerNotes || "").trim().slice(0, 2000) || null;
    if (!serviceProfileId || !offeringId || !staffId || !startsAt || !customerName || !customerPhone) {
      return NextResponse.json({ success: false, error: { code: "bad_request", message: "Service, staff, time, name and phone are required." } }, { status: 400 });
    }
    const parsed = new Date(startsAt);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ success: false, error: { code: "bad_request", message: "Choose a valid appointment time." } }, { status: 400 });
    const { data, error } = await supabaseAdmin.rpc("create_service_appointment", {
      p_service_profile_id: serviceProfileId,
      p_offering_id: offeringId,
      p_staff_id: staffId,
      p_customer_user_id: user.id,
      p_customer_name: customerName,
      p_customer_email: customerEmail || null,
      p_customer_phone: customerPhone,
      p_starts_at: parsed.toISOString(),
      p_customer_notes: customerNotes,
    });
    if (error) {
      const message = error.message;
      const map: Record<string, [number, string]> = {
        booking_time_required: [400, "Choose an appointment time."],
        customer_name_required: [400, "Add your name."],
        service_not_bookable: [409, "This service is no longer bookable."],
        staff_not_bookable: [409, "This staff member is no longer available."],
        staff_cannot_perform_service: [409, "This staff member cannot perform that service."],
        booking_notice_violation: [409, "That time is inside the provider's booking notice window."],
        booking_window_violation: [409, "That time is outside the provider's booking window."],
        staff_unavailable: [409, "That time is no longer available."],
        slot_unavailable: [409, "That slot was just taken. Please choose another."],
      };
      const key = Object.keys(map).find((entry) => message.includes(entry));
      if (key) return NextResponse.json({ success: false, error: { code: key, message: map[key][1] } }, { status: map[key][0] });
      return NextResponse.json({ success: false, error: { code: "booking_failed", message: "Unable to create the appointment." } }, { status: 409 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: { code: "bad_request", message: "Unable to create the appointment." } }, { status: 400 });
  }
}
