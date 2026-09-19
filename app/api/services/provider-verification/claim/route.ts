import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSupplierOwnedBusiness } from "@/lib/suppliers/readiness";

export const dynamic = "force-dynamic";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function currentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = String(body.action || "");

  if (action === "create_claim") {
    const staffId = String(body.staffId || "").trim();
    if (!staffId) return NextResponse.json({ error: "staffId is required." }, { status: 400 });

    const { business } = await getSupplierOwnedBusiness(user.id);
    if (!business) return NextResponse.json({ error: "Service business not found." }, { status: 404 });

    const { data: profile } = await supabaseAdmin
      .from("service_profiles")
      .select("id")
      .eq("business_id", business.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ error: "Service profile not found." }, { status: 404 });

    const { data: staff } = await supabaseAdmin
      .from("service_staff")
      .select("id,display_name,user_id")
      .eq("id", staffId)
      .eq("service_profile_id", profile.id)
      .maybeSingle();

    if (!staff) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    if (staff.user_id) {
      return NextResponse.json({ error: "This specialist is already linked to a SafariPlug account." }, { status: 409 });
    }

    await supabaseAdmin
      .from("service_staff_claim_tokens")
      .delete()
      .eq("staff_id", staff.id)
      .is("consumed_at", null);

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("service_staff_claim_tokens")
      .insert({
        staff_id: staff.id,
        token_hash: hashToken(token),
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      ok: true,
      claimUrl: `${origin}/services/provider-verification?claim=${encodeURIComponent(token)}`,
      expiresAt,
      staff: { id: staff.id, displayName: staff.display_name },
      externalMessageSent: false,
    });
  }

  if (action === "accept_claim") {
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Claim token is required." }, { status: 400 });

    const { data: claim, error: claimError } = await supabaseAdmin
      .from("service_staff_claim_tokens")
      .select("id,staff_id,expires_at,consumed_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle();

    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!claim || claim.consumed_at || new Date(claim.expires_at) <= new Date()) {
      return NextResponse.json({ error: "This specialist verification link is invalid or expired." }, { status: 410 });
    }

    const { data: claimedStaff, error: claimedStaffError } = await supabaseAdmin
      .from("service_staff")
      .select("id,display_name,user_id,verification_state")
      .eq("id", claim.staff_id)
      .maybeSingle();

    if (claimedStaffError) return NextResponse.json({ error: claimedStaffError.message }, { status: 500 });

    if (claimedStaff?.user_id === user.id) {
      const consumedAt = claim.consumed_at || new Date().toISOString();
      if (!claim.consumed_at) {
        await supabaseAdmin
          .from("service_staff_claim_tokens")
          .update({ consumed_at: consumedAt })
          .eq("id", claim.id)
          .is("consumed_at", null);
      }
      return NextResponse.json({
        ok: true,
        staff: claimedStaff,
        claimedAt: consumedAt,
        recovered: true,
      });
    }

    if (claimedStaff?.user_id && claimedStaff.user_id !== user.id) {
      return NextResponse.json({ error: "This specialist profile is already claimed." }, { status: 409 });
    }

    const { data: existing } = await supabaseAdmin
      .from("service_staff")
      .select("id")
      .eq("user_id", user.id)
      .neq("id", claim.staff_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "This SafariPlug account is already linked to another service specialist." }, { status: 409 });
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("service_staff")
      .update({
        user_id: user.id,
        verification_state: "unverified",
        identity_liveness_verified_at: null,
      })
      .eq("id", claim.staff_id)
      .is("user_id", null)
      .select("id,display_name,user_id,verification_state")
      .maybeSingle();

    if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
    if (!staff) return NextResponse.json({ error: "This specialist profile is already claimed." }, { status: 409 });

    const consumedAt = new Date().toISOString();
    await supabaseAdmin
      .from("service_staff_claim_tokens")
      .update({ consumed_at: consumedAt })
      .eq("id", claim.id)
      .is("consumed_at", null);

    return NextResponse.json({
      ok: true,
      staff,
      claimedAt: consumedAt,
    });
  }

  return NextResponse.json({ error: "Unsupported claim action." }, { status: 400 });
}
