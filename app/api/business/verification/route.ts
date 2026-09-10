import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getVerificationAdapter } from "@/lib/integrations/verification/registry";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  }

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id,name,verified,claimed")
    .eq("owner_id", user.id)
    .in("status", ["active", "ACTIVE"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "Create your service business before starting verification." }, { status: 404 });

  let { data: current } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
    .eq("subject_type", "provider")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current?.status === "approved") {
    return NextResponse.json({ case: current, business, message: "Provider verification is already approved." });
  }

  if (!current || ["rejected", "revoked", "expired"].includes(current.status)) {
    const { data, error } = await supabaseAdmin
      .from("verification_cases")
      .insert({
        id: crypto.randomUUID(),
        subject_type: "provider",
        subject_id: user.id,
        status: "pending",
        verification_level: "enhanced",
        provider: "sumsub",
        notes: "Enhanced provider verification requires identity and live liveness.",
      })
      .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Unable to create verification case." }, { status: 400 });
    current = data;
  }

  if (!current.external_id) {
    const adapter = getVerificationAdapter("identity_provider");
    const result = await adapter.requestExternalCheck(current.id);
    if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 503 });

    const { data, error } = await supabaseAdmin
      .from("verification_cases")
      .update({ external_id: result.data.external_id, provider: "sumsub", status: "pending" })
      .eq("id", current.id)
      .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Unable to save Sumsub applicant." }, { status: 500 });
    current = data;
  }

  return NextResponse.json({ case: current, business, message: "Verification case is ready. Request the secure SDK session to continue." });
}
