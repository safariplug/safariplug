import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id,name,slug,description,city_id,restaurant_settings!inner(ordering_enabled,pickup_enabled)")
    .eq("business_type", "Restaurant")
    .eq("status", "active")
    .eq("restaurant_settings.ordering_enabled", true)
    .eq("restaurant_settings.pickup_enabled", true)
    .order("name");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "restaurants_query_failed", message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
