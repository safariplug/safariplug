import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createSumsubAccessToken,
  sumsubConfigured,
  sumsubVerificationLevel,
} from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  }

  const automated = sumsubConfigured();

  const { data: staff, error: staffError } = await supabaseAdmin
    .from("service_staff")
    .select("id,display_name,personal_photo_url,status,verification_state,identity_liveness_verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (!staff) return NextResponse.json({ error: "No service specialist profile is linked to this account." }, { status: 404 });
  if (!staff.personal_photo_url) {
    return NextResponse.json({ error: "A personal specialist photo is required before verification." }, { status: 409 });
  }

  let { data: current, error: caseError } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,expires_at")
    .eq("subject_type", "service_staff")
    .eq("subject_id", staff.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (caseError) return NextResponse.json({ error: caseError.message }, { status: 500 });

  if (!automated && current && ["pending", "in_review", "not_started"].includes(current.status) && current.provider !== "human_review") {
    const { data: converted, error: convertError } = await supabaseAdmin
      .from("verification_cases")
      .update({
        provider: "human_review",
        verification_level: "basic",
        external_id: null,
      })
      .eq("id", current.id)
      .select("id,status,verification_level,provider,external_id,expires_at")
      .single();
    if (convertError || !converted) return NextResponse.json({ error: "Unable to convert specialist verification to staff review." }, { status: 500 });
    current = converted;
    const { data: evidence } = await supabaseAdmin.from("verification_evidence").select("id").eq("case_id", current.id).eq("evidence_type", "provider_attestation").maybeSingle();
    if (!evidence) await supabaseAdmin.from("verification_evidence").insert({ case_id: current.id, evidence_type: "provider_attestation", status: "submitted", provider: "human_review", submitted_at: new Date().toISOString() });
  }

  if (
    current?.status === "approved" &&
    (!current.expires_at || new Date(current.expires_at) > new Date()) &&
    (current.provider === "human_review" || staff.identity_liveness_verified_at)
  ) {
    return NextResponse.json({ error: "Service specialist verification is already approved." }, { status: 409 });
  }

  if (!current || ["rejected", "revoked", "expired"].includes(current.status)) {
    const created = await supabaseAdmin
      .from("verification_cases")
      .insert({
        subject_type: "service_staff",
        subject_id: staff.id,
        status: "pending",
        verification_level: automated ? "enhanced" : "basic",
        provider: automated ? "sumsub" : "human_review",
        notes: automated
          ? "Service specialist identity + live face/liveness verification started from linked SafariPlug account."
          : "SafariPlug staff review requested by the authenticated specialist account.",
      })
      .select("id,status,verification_level,provider,external_id,expires_at")
      .single();

    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error?.message || "Unable to create specialist verification case." },
        { status: 500 }
      );
    }
    current = created.data;

    if (!automated) {
      const { error: evidenceError } = await supabaseAdmin.from("verification_evidence").insert({
        case_id: current.id,
        evidence_type: "provider_attestation",
        status: "submitted",
        provider: "human_review",
        submitted_at: new Date().toISOString(),
      });
      if (evidenceError) {
        return NextResponse.json({ error: "Unable to record specialist attestation." }, { status: 500 });
      }
    }
  }

  if (!["pending", "in_review", "not_started"].includes(current.status)) {
    return NextResponse.json(
      { error: "This specialist verification case cannot be restarted. Contact SafariPlug support." },
      { status: 409 }
    );
  }

  if (!automated) {
    await supabaseAdmin
      .from("service_staff")
      .update({ verification_state: "pending", identity_liveness_verified_at: null })
      .eq("id", staff.id)
      .neq("verification_state", "verified");

    return NextResponse.json({
      manualReview: true,
      caseId: current.id,
      message: "SafariPlug staff review requested. No paid external verification provider is required.",
    });
  }

  const externalUserId = `safariplug:${current.id}`;
  const token = await createSumsubAccessToken({
    userId: externalUserId,
    email: user.email,
    phone: user.phone,
  });

  if (!token.token) return NextResponse.json({ error: "Sumsub did not return an access token." }, { status: 502 });

  const { error: updateError } = await supabaseAdmin
    .from("verification_cases")
    .update({
      provider: "sumsub",
      external_id: externalUserId,
      verification_level: "enhanced",
      status: current.status === "not_started" ? "pending" : current.status,
    })
    .eq("id", current.id);

  if (updateError) {
    return NextResponse.json({ error: "Unable to link the specialist verification session." }, { status: 500 });
  }

  await supabaseAdmin
    .from("service_staff")
    .update({ verification_state: "pending", identity_liveness_verified_at: null })
    .eq("id", staff.id)
    .neq("verification_state", "verified");

  return NextResponse.json({
    accessToken: token.token,
    userId: token.userId,
    levelName: sumsubVerificationLevel,
    caseId: current.id,
  });
}
