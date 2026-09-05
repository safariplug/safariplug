import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await supabaseAdmin.from("service_profiles").select("id,business_id,timezone,businesses!inner(id,name,slug,description,city_id),service_categories(name),service_offerings(id,name,slug,description,duration_minutes,price,currency,requires_confirmation)").eq("status","active").eq("booking_status","open").eq("service_offerings.status","active");
  if (error) return NextResponse.json({ error: "Unable to load services" }, { status: 500 });
  return NextResponse.json({ services: data ?? [] });
}