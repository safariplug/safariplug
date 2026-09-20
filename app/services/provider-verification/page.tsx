import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import SpecialistVerificationStart from "./SpecialistVerificationStart";
import { sumsubConfigured } from "@/lib/integrations/verification/sumsub";

export const dynamic = "force-dynamic";

export default async function SpecialistVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const { claim } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    const next = `/services/provider-verification${claim ? `?claim=${encodeURIComponent(claim)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: staff } = await supabaseAdmin
    .from("service_staff")
    .select("id,display_name,personal_photo_url,status,verification_state,identity_liveness_verified_at,service_profile_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: verification } = staff
    ? await supabaseAdmin
        .from("verification_cases")
        .select("id,status,verification_level,provider,reviewed_at,expires_at,rejection_reason")
        .eq("subject_type", "service_staff")
        .eq("subject_id", staff.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const automatedReady = sumsubConfigured();
  const approved = Boolean(
    staff?.verification_state === "verified" &&
      verification?.status === "approved" &&
      (verification?.provider === "human_review" || staff?.identity_liveness_verified_at) &&
      (!verification.expires_at || new Date(verification.expires_at) > new Date())
  );

  let businessName = "SafariPlug service provider";
  if (staff?.service_profile_id) {
    const { data: profile } = await supabaseAdmin
      .from("service_profiles")
      .select("business_id")
      .eq("id", staff.service_profile_id)
      .maybeSingle();
    if (profile?.business_id) {
      const { data: business } = await supabaseAdmin
        .from("businesses")
        .select("name")
        .eq("id", profile.business_id)
        .maybeSingle();
      if (business?.name) businessName = business.name;
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-12 text-[#111]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold">← SafariPlug</Link>
        <p className="mt-10 text-[11px] font-bold uppercase tracking-[.22em] text-black/40">Service specialist trust</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Verify the person customers are booking.</h1>
        <p className="mt-4 max-w-2xl leading-7 text-black/55">
          SafariPlug requires each specific bookable specialist to have their own linked account, personal photo and an approved trust review. At launch this can be completed by SafariPlug staff; automated identity + liveness can be added later. A business-owner verification does not automatically verify every barber, masseur, nail technician, tattoo artist, instructor or other team member.
        </p>

        {staff ? (
          <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              {staff.personal_photo_url ? (
                <img src={staff.personal_photo_url} alt={staff.display_name} className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-2xl bg-black/[.05] text-xs text-black/35">No photo</div>
              )}
              <div>
                <p className="text-xl font-semibold">{staff.display_name}</p>
                <p className="mt-1 text-sm text-black/45">{businessName}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-black/35">
                  {approved ? "Verified specialist" : verification?.status || staff.verification_state}
                </p>
              </div>
            </div>

            {verification?.rejection_reason ? (
              <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{verification.rejection_reason}</p>
            ) : null}

            <SpecialistVerificationStart
              claimToken={claim || null}
              initialStatus={approved ? "verified" : staff.verification_state}
              automatedReady={automatedReady}
            />
          </section>
        ) : (
          <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{claim ? "Claim your specialist profile" : "No linked specialist profile"}</h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              {claim
                ? "This secure claim link connects the team profile created by the business to your authenticated SafariPlug account. After linking, you can complete your own identity + live face verification."
                : "Ask the SafariPlug business owner to create a secure specialist verification link for your team profile."}
            </p>
            <SpecialistVerificationStart claimToken={claim || null} initialStatus={null} automatedReady={automatedReady} />
          </section>
        )}

        <div className="mt-6 rounded-[1.5rem] bg-[#111] p-6 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Verification boundary</p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            SafariPlug records who reviewed the specialist and the final result. Manual staff review is the launch method; automated identity + liveness remains an optional future upgrade.
          </p>
        </div>
      </div>
    </main>
  );
}
