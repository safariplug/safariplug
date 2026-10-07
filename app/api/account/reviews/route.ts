import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function requireTraveler() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requireTraveler();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const appointmentId = url.searchParams.get("appointmentId");

  let query = supabaseAdmin
    .from("traveler_reviews")
    .select("id,product_type,source_id,business_id,rating,dimensions,title,body,verified_booking,moderation_status,supplier_response,supplier_responded_at,created_at,updated_at")
    .eq("traveler_id", user.id)
    .order("created_at", { ascending: false });

  if (appointmentId) query = query.eq("product_type", "service").eq("source_id", appointmentId);

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(request: Request) {
  const user = await requireTraveler();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const appointmentId = String(body?.appointmentId || "").trim();
  const rating = Number(body?.rating);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const reviewBody = typeof body?.body === "string" ? body.body.trim().slice(0, 4000) : "";
  const dimensionsRaw = body?.dimensions && typeof body.dimensions === "object" ? body.dimensions : {};
  const dimensions = {
    professionalism: Number(dimensionsRaw.professionalism || 0),
    quality: Number(dimensionsRaw.quality || 0),
    punctuality: Number(dimensionsRaw.punctuality || 0),
    value: Number(dimensionsRaw.value || 0),
  };

  if (!appointmentId) return NextResponse.json({ error: "Appointment is required." }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Overall rating must be between 1 and 5." }, { status: 400 });
  for (const value of Object.values(dimensions)) {
    if (!Number.isInteger(value) || value < 1 || value > 5) return NextResponse.json({ error: "Each review dimension must be between 1 and 5." }, { status: 400 });
  }

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("service_appointments")
    .select("id,customer_user_id,status,service_profile_id,service_profiles!inner(business_id,businesses!inner(id,name))")
    .eq("id", appointmentId)
    .eq("customer_user_id", user.id)
    .maybeSingle();

  if (appointmentError) return NextResponse.json({ error: appointmentError.message }, { status: 500 });
  if (!appointment) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (appointment.status !== "completed") {
    return NextResponse.json({ error: "Only completed SafariPlug appointments can be reviewed." }, { status: 409 });
  }

  const profile = appointment.service_profiles as any;
  const businessId = profile?.business_id || profile?.businesses?.id || null;
  if (!businessId) return NextResponse.json({ error: "Provider record is incomplete." }, { status: 409 });

  const { data: review, error } = await supabaseAdmin
    .from("traveler_reviews")
    .upsert({
      traveler_id: user.id,
      product_type: "service",
      source_id: appointment.id,
      business_id: businessId,
      rating,
      dimensions,
      title: title || null,
      body: reviewBody || null,
      verified_booking: true,
      moderation_status: "approved",
    }, { onConflict: "traveler_id,product_type,source_id" })
    .select("id,product_type,source_id,business_id,rating,dimensions,title,body,verified_booking,moderation_status,supplier_response,supplier_responded_at,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review }, { status: 201 });
}
