import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = request.headers.get("x-real-ip")?.trim();
    const ip = (forwarded || realIp || "unknown").slice(0, 120);
    const { data: allowed, error: rateError } = await supabaseAdmin.rpc("consume_concierge_rate_limit", {
      p_bucket: `concierge-book:${ip}`,
      p_limit: 10,
      p_window_seconds: 60,
    });
    if (rateError) return NextResponse.json({ error: "Booking is temporarily unavailable." }, { status: 503 });
    if (allowed !== true) return NextResponse.json({ error: "Too many booking attempts. Please wait a moment and try again." }, { status: 429 });

    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "registered_client_required" }, { status: 401 });
    }

    const body = await request.json();
    const required = ["serviceProfileId", "offeringId", "staffId", "startsAt", "customerName"];
    for (const key of required) {
      if (!body?.[key] || typeof body[key] !== "string") {
        return NextResponse.json({ error: `${key} is required` }, { status: 400 });
      }
    }

    const serviceProfileId = body.serviceProfileId.trim();
    const offeringId = body.offeringId.trim();
    const staffId = body.staffId.trim();
    const startsAt = body.startsAt.trim();
    const customerName = body.customerName.trim().slice(0, 160);
    const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim().slice(0, 40) : null;
    const customerNotes = typeof body.customerNotes === "string" ? body.customerNotes.trim().slice(0, 1000) : null;
    if (!customerName) return NextResponse.json({ error: "customerName is required" }, { status: 400 });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("service_profiles")
      .select("id,status,booking_status,timezone,booking_notice_minutes,max_booking_days")
      .eq("id", serviceProfileId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== "active" || profile.booking_status !== "open") {
      return NextResponse.json({ error: "This provider is not accepting bookings." }, { status: 409 });
    }

    const { data: offering, error: offeringError } = await supabaseAdmin
      .from("service_offerings")
      .select("id,service_profile_id,status,duration_minutes,price,currency,requires_confirmation")
      .eq("id", offeringId)
      .eq("service_profile_id", serviceProfileId)
      .maybeSingle();
    if (offeringError) throw offeringError;
    if (!offering || offering.status !== "active") {
      return NextResponse.json({ error: "This service is no longer available." }, { status: 409 });
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("service_staff")
      .select("id,service_profile_id,status")
      .eq("id", staffId)
      .eq("service_profile_id", serviceProfileId)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staff || staff.status !== "active") {
      return NextResponse.json({ error: "This specialist is no longer available." }, { status: 409 });
    }

    const { data: qualified, error: qualifiedError } = await supabaseAdmin
      .from("service_staff_offerings")
      .select("staff_id")
      .eq("staff_id", staffId)
      .eq("offering_id", offeringId)
      .maybeSingle();
    if (qualifiedError) throw qualifiedError;
    if (!qualified) return NextResponse.json({ error: "This specialist cannot provide the selected service." }, { status: 409 });

    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return NextResponse.json({ error: "Invalid appointment time" }, { status: 400 });
    const minStart = Date.now() + Math.max(0, Number(profile.booking_notice_minutes || 0)) * 60_000;
    const maxStart = Date.now() + Math.max(1, Number(profile.max_booking_days || 90)) * 86_400_000;
    if (start.getTime() < minStart || start.getTime() > maxStart) {
      return NextResponse.json({ error: "This appointment time is outside the provider's booking window." }, { status: 409 });
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com";
    const availabilityUrl = new URL("/api/services/availability", base);
    availabilityUrl.searchParams.set("serviceProfileId", serviceProfileId);
    availabilityUrl.searchParams.set("offeringId", offeringId);
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone || "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
    availabilityUrl.searchParams.set("date", localDate);
    const availabilityResponse = await fetch(availabilityUrl, { cache: "no-store" });
    const availability = await availabilityResponse.json();
    if (!availabilityResponse.ok) return NextResponse.json({ error: availability.error || "Unable to verify the selected slot." }, { status: 409 });
    const exactSlot = (availability.slots ?? []).find((slot: any) => slot.staffId === staffId && new Date(slot.startsAt).getTime() === start.getTime());
    if (!exactSlot) return NextResponse.json({ error: "That appointment time is no longer available. Please choose another live time." }, { status: 409 });

    const { data: appointment, error } = await supabaseAdmin.rpc("create_service_appointment", {
      p_service_profile_id: serviceProfileId,
      p_offering_id: offeringId,
      p_staff_id: staffId,
      p_customer_user_id: user.id,
      p_customer_name: customerName,
      p_customer_email: user.email ?? null,
      p_customer_phone: customerPhone,
      p_starts_at: startsAt,
      p_customer_notes: customerNotes,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("slot_unavailable") ? 409 : 400 });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    console.error("concierge-book", error);
    return NextResponse.json({ error: "SafariPlug could not complete the booking." }, { status: 500 });
  }
}
