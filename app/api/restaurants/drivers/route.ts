import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,service_city,service_country,service_status,verification_state")
    .eq("service_status", "active")
    .eq("verification_state", "verified")
    .order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}
