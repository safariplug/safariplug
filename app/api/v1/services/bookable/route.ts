import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("service_profiles")
    .select("id,timezone,businesses!inner(id,name,slug,description,city_id),service_categories!inner(name,slug),service_offerings!inner(id,name,description,duration_minutes,price,currency,requires_confirmation,status)")
    .eq("status", "active")
    .eq("booking_status", "open")
    .eq("businesses.status", "active")
    .eq("service_categories.status", "active")
    .eq("service_offerings.status", "active")
    .order("id");
  if (error) return NextResponse.json({ success: false, error: { code: "services_query_failed", message: error.message } }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}
