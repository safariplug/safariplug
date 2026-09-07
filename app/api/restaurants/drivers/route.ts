import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("id,display_name,service_city,service_country,preferred,capabilities")
    .eq("service_status", "active")
    .eq("verification_state", "verified")
    .order("preferred", { ascending: false })
    .order("display_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drivers: data ?? [] });
}
