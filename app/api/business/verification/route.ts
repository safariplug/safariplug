import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSupplierOwnedBusiness } from "@/lib/suppliers/readiness";
import { getVerificationAdapter } from "@/lib/integrations/verification/registry";
import { sumsubConfigured } from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  }

  const { business } = await getSupplierOwnedBusiness(user.id);
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

  const automated = sumsubConfigured();

  if (!current || ["rejected", "revoked", "expired"].includes(current.status)) {
    const { data, error } = await supabaseAdmin
      .from("verification_cases")
      .insert({
        id: crypto.randomUUID(),
        subject_type: "provider",
        subject_id: user.id,
        status: "pending",
        verification_level: automated ? "enhanced" : "basic",
        provider: automated ? "sumsub" : "human_review",
        notes: automated
          ? "Enhanced provider verification requires identity and live liveness."
          : "SafariPlug staff review requested by the authenticated provider account.",
      })
      .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Unable to create verification case." }, { status: 400 });
    current = data;

    if (!automated) {
      const { error: evidenceError } = await supabaseAdmin.from("verification_evidence").insert({
        case_id: current.id,
        evidence_type: "provider_attestation",
        status: "submitted",
        provider: "human_review",
        submitted_at: new Date().toISOString(),
      });
      if (evidenceError) return NextResponse.json({ error: "Unable to record provider attestation." }, { status: 500 });
    }
  }

  if (!automated) {
    return NextResponse.json({
      case: current,
      business,
      manualReview: true,
      message: "SafariPlug staff review requested. No paid external verification provider is required.",
    });
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
