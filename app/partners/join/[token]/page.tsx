import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { invitationDestination, invitationEnrollmentKind, resolveSupplierInvitationConfig } from "@/lib/suppliers/invitation-config";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
}

type StableEnrollmentLink = {
  prospect_id?: string | null;
  partner_id?: string | null;
};

function assertCompatibleEnrollmentLink(existing: StableEnrollmentLink, invitation: StableEnrollmentLink) {
  if (existing.prospect_id && invitation.prospect_id && existing.prospect_id !== invitation.prospect_id) {
    throw new Error("This account is already linked to a different SafariPlug prospect. Staff must resolve the CRM link before this invitation can continue.");
  }
  if (existing.partner_id && invitation.partner_id && existing.partner_id !== invitation.partner_id) {
    throw new Error("This account is already linked to a different SafariPlug partner relationship. Staff must resolve the CRM link before this invitation can continue.");
  }
}

async function preflightSupplierEnrollment(userId: string, invitation: StableEnrollmentLink) {
  const { data: existingSupplier, error } = await supabaseAdmin
    .from("supplier_accounts")
    .select("prospect_id,partner_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existingSupplier) assertCompatibleEnrollmentLink(existingSupplier, invitation);
}

async function provisionSupplierEnrollment(user: { id: string; email?: string | null }, invitation: { id: string; business_name: string; partner_type: string; prospect_id?: string | null; partner_id?: string | null }) {
  const config = resolveSupplierInvitationConfig(invitation.partner_type);
  if (!config) return false;

  const { data: existingSupplier, error: supplierLookupError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,prospect_id,partner_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (supplierLookupError) throw new Error(supplierLookupError.message);
  if (existingSupplier) {
    assertCompatibleEnrollmentLink(existingSupplier, invitation);
    const updates: Record<string, string> = {};
    if (!existingSupplier.prospect_id && invitation.prospect_id) updates.prospect_id = invitation.prospect_id;
    if (!existingSupplier.partner_id && invitation.partner_id) updates.partner_id = invitation.partner_id;
    if (Object.keys(updates).length) {
      const { error: linkError } = await supabaseAdmin.from("supplier_accounts").update(updates).eq("id", existingSupplier.id);
      if (linkError) throw new Error(linkError.message);
    }
    return true;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("full_name,phone")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  let { data: business, error: businessLookupError } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (businessLookupError) throw new Error(businessLookupError.message);

  if (!business) {
    const baseSlug = slugify(invitation.business_name) || `partner-${user.id.slice(0, 8)}`;
    let slug = baseSlug;
    for (let suffix = 2; suffix < 100; suffix += 1) {
      const { data: taken, error: slugError } = await supabaseAdmin.from("businesses").select("id").eq("slug", slug).maybeSingle();
      if (slugError) throw new Error(slugError.message);
      if (!taken) break;
      slug = `${baseSlug}-${suffix}`;
    }
    const phone = profile?.phone?.trim() || null;
    const { data: createdBusiness, error: businessError } = await supabaseAdmin
      .from("businesses")
      .insert({ owner_id: user.id, name: invitation.business_name, slug, business_type: config.businessType, phone, whatsapp: phone, email: user.email || null, supplier_contact_name: profile?.full_name?.trim() || invitation.business_name, status: "INACTIVE", verified: false, claimed: true })
      .select("id")
      .single();
    if (businessError || !createdBusiness) throw new Error(businessError?.message || "Unable to create invited partner business.");
    business = createdBusiness;
  }

  if (config.category) {
    const { data: serviceProfile, error: serviceProfileLookupError } = await supabaseAdmin
      .from("service_profiles")
      .select("id")
      .eq("business_id", business.id)
      .maybeSingle();
    if (serviceProfileLookupError) throw new Error(serviceProfileLookupError.message);
    if (!serviceProfile) {
      const { data: category, error: categoryError } = await supabaseAdmin
        .from("service_categories")
        .select("id")
        .eq("name", config.category)
        .eq("status", "active")
        .maybeSingle();
      if (categoryError) throw new Error(categoryError.message);
      if (!category) throw new Error(`Service category ${config.category} is not available.`);
      const { error: createProfileError } = await supabaseAdmin
        .from("service_profiles")
        .insert({ business_id: business.id, category_id: category.id, status: "pending", booking_status: "closed" });
      if (createProfileError) throw new Error(createProfileError.message);
    }
  }

  const { error: supplierError } = await supabaseAdmin.from("supplier_accounts").insert({
    user_id: user.id,
    business_id: business.id,
    contact_name: profile?.full_name?.trim() || invitation.business_name,
    invitation_status: "accepted",
    onboarding_status: "draft",
    completion_percent: 0,
    accepted_at: new Date().toISOString(),
    prospect_id: invitation.prospect_id || null,
    partner_id: invitation.partner_id || null,
  });
  if (supplierError) throw new Error(supplierError.message);
  return true;
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: invitation } = await supabaseAdmin
    .from("partner_invitations")
    .select("id,business_name,partner_type,status,opened_at,onboarded_user_id,prospect_id,partner_id")
    .eq("invitation_token", token)
    .maybeSingle();
  if (!invitation) notFound();

  const enrollmentKind = invitationEnrollmentKind(invitation.partner_type);
  const href = invitationDestination(invitation.partner_type);
  if (enrollmentKind === "unsupported" || !href) {
    return <main className="mx-auto max-w-2xl p-6 py-16"><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Partner Invitation</p><h1 className="mt-4 text-4xl font-semibold">This invitation needs SafariPlug review.</h1><p className="mt-5 text-black/60">Your invitation is valid, but its supplier category has not been mapped to a safe onboarding flow yet. SafariPlug staff must classify the supplier before account enrollment continues. Please do not create a second account.</p><p className="mt-5 rounded-2xl bg-black/[.04] p-4 text-sm text-black/55">Invitation type: {invitation.partner_type || "Unclassified"}</p></main>;
  }

  if (!invitation.opened_at) {
    await supabaseAdmin.from("partner_invitations").update({ opened_at: new Date().toISOString(), status: invitation.status === "sent" ? "opened" : invitation.status }).eq("id", invitation.id);
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const next = `/partners/join/${token}`;
  if (!user) return <main className="mx-auto max-w-2xl p-6 py-16"><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">SafariPlug Partner Invitation</p><h1 className="mt-4 text-4xl font-semibold">You’re invited, {invitation.business_name}.</h1><p className="mt-5 text-black/60">Join SafariPlug as a {invitation.partner_type}. Create or sign in to your SafariPlug account first. Your invitation will remain attached to your enrollment.</p><Link href={`/login?mode=signup&as=partner&next=${encodeURIComponent(next)}`} className="mt-8 inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white">Create partner account</Link><p className="mt-5 text-sm text-black/45">Signing up does not automatically verify or activate a listing. Marketplace-specific identity, business, licensing, photo and compliance checks still apply.</p></main>;

  if (invitation.onboarded_user_id && invitation.onboarded_user_id !== user.id) notFound();
  await preflightSupplierEnrollment(user.id, invitation);
  if (!invitation.onboarded_user_id) {
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("partner_invitations")
      .update({
        onboarded_user_id: user.id,
        signup_started_at: new Date().toISOString(),
        status: "signup_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .is("onboarded_user_id", null)
      .select("onboarded_user_id")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);

    if (!claimed || claimed.onboarded_user_id !== user.id) {
      const { data: latest, error: latestError } = await supabaseAdmin
        .from("partner_invitations")
        .select("onboarded_user_id")
        .eq("id", invitation.id)
        .maybeSingle();
      if (latestError) throw new Error(latestError.message);
      if (!latest || latest.onboarded_user_id !== user.id) notFound();
    } else if (invitation.prospect_id || invitation.partner_id) {
      await supabaseAdmin.from("crm_activities").insert({
        prospect_id: invitation.prospect_id || null,
        partner_id: invitation.partner_id || null,
        activity_type: "system",
        summary: "Partner signup started",
        details: `Invitation ${invitation.id} was claimed by the partner account.`,
      });
    }
  }

  const provisioned = await provisionSupplierEnrollment(user, invitation);
  if (provisioned) {
    const onboardingAt = new Date().toISOString();
    await supabaseAdmin.from("partner_invitations").update({ status: "onboarding", updated_at: onboardingAt }).eq("id", invitation.id).eq("onboarded_user_id", user.id);

    if (invitation.prospect_id) {
      const { error: followupError } = await supabaseAdmin
        .from("crm_followups")
        .update({ status: "completed", completed_at: onboardingAt, updated_at: onboardingAt })
        .eq("prospect_id", invitation.prospect_id)
        .eq("status", "open")
        .ilike("title", "%invitation%")
        .ilike("notes", `%Invitation ${invitation.id}%`);
      if (followupError) {
        console.error("Partner entered onboarding but invitation follow-up could not be completed", followupError);
      }
    }

    if (invitation.status !== "onboarding" && (invitation.prospect_id || invitation.partner_id)) {
      await supabaseAdmin.from("crm_activities").insert({
        prospect_id: invitation.prospect_id || null,
        partner_id: invitation.partner_id || null,
        activity_type: "system",
        summary: "Supplier onboarding started",
        details: `Invitation ${invitation.id} entered supplier onboarding.`,
      });
    }
  }

  return <main className="mx-auto max-w-2xl p-6 py-16"><p className="text-xs font-semibold uppercase tracking-[.2em] text-black/40">Enrollment started</p><h1 className="mt-4 text-4xl font-semibold">Welcome to SafariPlug, {invitation.business_name}.</h1><p className="mt-5 text-black/60">Your account is linked to this invitation. Continue into the existing onboarding flow for {invitation.partner_type}. Your listing will not become verified or public until the applicable requirements are completed.</p><Link href={href} className="mt-8 inline-flex rounded-full bg-black px-6 py-3 font-semibold text-white">Continue onboarding →</Link></main>;
}
