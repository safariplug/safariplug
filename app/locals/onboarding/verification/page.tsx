import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import LocalVerificationStart from "./LocalVerificationStart";

export const dynamic = "force-dynamic";

export default async function LocalVerificationPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/account/login?next=/locals/onboarding/verification");

  const { data: profile } = await db
    .from("local_profiles")
    .select("id,display_name,personal_photo_url,verification_state,service_status,identity_liveness_verified_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/locals/onboarding");

  const { data: verification } = await supabaseAdmin
    .from("verification_cases")
    .select("id,status,verification_level,provider,created_at,reviewed_at,expires_at,rejection_reason")
    .eq("subject_type", "local")
    .eq("subject_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const approved =
    verification?.status === "approved" &&
    Boolean(profile.identity_liveness_verified_at) &&
    (!verification.expires_at || new Date(verification.expires_at) > new Date());

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/locals/onboarding" className="text-sm font-semibold">← Local profile</Link>
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[.2em] text-black/40">Trust & safety</p>
        <h1 className="mt-3 text-4xl font-semibold">Identity + live face verification</h1>
        <p className="mt-4 max-w-2xl leading-7 text-black/55">
          SafariPlug requires a real external identity and live face/liveness check before a Local can be represented as verified or activated publicly. A profile photo by itself is not verification.
        </p>

        <section className="mt-7 rounded-[2rem] bg-white p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Status label="Profile" value={profile.display_name} />
            <Status label="Verification" value={approved ? "approved" : verification?.status || "not started"} />
            <Status label="Marketplace" value={profile.service_status} />
          </div>

          {verification?.rejection_reason ? (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {verification.rejection_reason}
            </p>
          ) : null}

          <div className="mt-6 rounded-2xl bg-[#f2f0e9] p-5 text-sm leading-6 text-black/60">
            The identity/liveness result comes from the connected verification provider. SafariPlug staff cannot manually manufacture a successful external face check. Marketplace activation remains a separate staff-controlled decision after verification succeeds.
          </div>

          <LocalVerificationStart status={approved ? "approved" : verification?.status || null} />
        </section>

        <Link href="/locals/onboarding/availability" className="mt-6 inline-block text-sm font-semibold">
          Manage availability →
        </Link>
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/[.035] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">{label}</p>
      <p className="mt-2 font-semibold capitalize">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
