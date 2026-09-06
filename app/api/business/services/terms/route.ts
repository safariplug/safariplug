import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const TERMS_VERSION = "service-provider-terms-v1-2026-09-05";

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
      return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    }
    const body = await request.json();
    if (body.accept !== true || !body.serviceProfileId) {
      return NextResponse.json({ error: "Terms acceptance is required." }, { status: 400 });
    }
    const { data: business } = await supabaseAdmin.from("businesses").select("id").eq("owner_id", user.id).eq("id", body.businessId || "").maybeSingle();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    const { data, error } = await supabaseAdmin.from("service_profiles").update({ provider_terms_version: TERMS_VERSION, provider_terms_accepted_at: new Date().toISOString(), provider_terms_accepted_by: user.id }).eq("id", body.serviceProfileId).eq("business_id", business.id).select("id,provider_terms_version,provider_terms_accepted_at,service_fee_percent").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ profile: data, termsVersion: TERMS_VERSION });
  } catch (error) {
    console.error("provider terms acceptance", error);
    return NextResponse.json({ error: "Unable to record terms acceptance." }, { status: 500 });
  }
}
