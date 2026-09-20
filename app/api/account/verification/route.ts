import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sumsubConfigured } from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    return NextResponse.json(
      { error: "A confirmed SafariPlug account is required." },
      { status: 401 }
    );
  }

  let { data: current } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
    .eq("subject_type", "traveler")
    .eq("subject_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    current?.status === "approved" &&
    (!current.expires_at || new Date(current.expires_at) > new Date())
  ) {
    return NextResponse.json({
      case: current,
      message: "Traveler verification is already approved.",
    });
  }

  const automated = sumsubConfigured();

  if (!current || ["rejected", "revoked", "expired"].includes(current.status)) {
    const { data, error } = await supabaseAdmin
      .from("verification_cases")
      .insert({
        id: crypto.randomUUID(),
        subject_type: "traveler",
        subject_id: user.id,
        status: "pending",
        verification_level: automated ? "enhanced" : "basic",
        provider: automated ? "sumsub" : "human_review",
        notes: automated
          ? "Traveler verification requires identity and live face/liveness before trust-sensitive bookings."
          : "SafariPlug staff review requested by the authenticated traveler account.",
      })
      .select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create traveler verification case." },
        { status: 400 }
      );
    }
    current = data;

    if (!automated) {
      const { error: evidenceError } = await supabaseAdmin.from("verification_evidence").insert({
        case_id: current.id,
        evidence_type: "provider_attestation",
        status: "submitted",
        provider: "human_review",
        submitted_at: new Date().toISOString(),
      });
      if (evidenceError) {
        return NextResponse.json({ error: "Unable to record traveler attestation." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({
    case: current,
    manualReview: !automated,
    message: automated
      ? "Traveler verification case is ready."
      : "SafariPlug staff review requested. No paid external verification provider is required.",
  });
}
