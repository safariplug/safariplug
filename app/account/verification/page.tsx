import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { describeVerificationProviders } from "@/lib/integrations/verification";
import TravelerVerificationStart from "./TravelerVerificationStart";

export const dynamic = "force-dynamic";

function tone(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["rejected", "revoked", "expired"].includes(status)) {
    return "border-red-200 bg-red-50 text-red-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function TravelerVerificationPage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) {
    redirect("/login?next=/account/verification");
  }

  const [{ data: current }, providers] = await Promise.all([
    supabaseAdmin
      .from("verification_cases")
      .select("id,status,verification_level,provider,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at")
      .eq("subject_type", "traveler")
      .eq("subject_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    describeVerificationProviders(),
  ]);

  const identity = providers.find((p) => p.key === "identity_provider");
  const liveness = providers.find((p) => p.key === "liveness_provider");
  const verified = Boolean(
    current?.status === "approved" &&
      (!current.expires_at || new Date(current.expires_at) > new Date())
  );

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <header className="border-b border-black/8 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <div>
            <Link href="/account" className="text-sm font-semibold">SafariPlug</Link>
            <p className="mt-1 text-[10px] uppercase tracking-[.25em] text-black/35">
              Traveler trust
            </p>
          </div>
          <Link href="/account" className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">
            My SafariPlug
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-black/40">
            Identity verification
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">
            Verify once for trust-sensitive bookings.
          </h1>
          <p className="mt-4 text-base leading-7 text-black/50">
            SafariPlug uses verified identity and live face/liveness evidence for bookings where a traveler is meeting or requesting a specific person. A normal selfie upload is not treated as verification.
          </p>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] bg-black p-6 text-white">
            <p className="text-[10px] uppercase tracking-[.22em] text-white/45">Account</p>
            <p className="mt-3 text-xl font-semibold">{user.email || user.phone || "SafariPlug traveler"}</p>
            <p className="mt-1 text-xs text-white/45">Authenticated traveler</p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <p className="text-[10px] uppercase tracking-[.22em] text-black/40">Verification</p>
            <p className="mt-3 text-xl font-semibold">{current?.status || "Not started"}</p>
            <p className="mt-1 text-xs text-black/45">Identity + live liveness</p>
          </div>
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <p className="text-[10px] uppercase tracking-[.22em] text-black/40">Booking trust</p>
            <p className="mt-3 text-xl font-semibold">{verified ? "Ready" : "Blocked"}</p>
            <p className="mt-1 text-xs text-black/45">For trust-sensitive bookings</p>
          </div>
        </section>

        {current ? (
          <section className={`mt-6 rounded-[1.75rem] border p-6 ${tone(current.status)}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] opacity-60">Current case</p>
                <h2 className="mt-2 text-xl font-semibold">{current.status.replaceAll("_", " ")}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 opacity-75">
                  {current.rejection_reason || current.notes || "Your verification case is being prepared."}
                </p>
              </div>
              <span className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-semibold">
                {current.verification_level}
              </span>
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-[2rem] bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-black/40">
                Required evidence
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Identity + live face check.</h2>
            </div>
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
              No trust-sensitive booking without approval
            </span>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <Requirement
              title="Identity verification"
              description="Government identity evidence is reviewed by the connected verification provider and linked to your authenticated SafariPlug account."
              ready={Boolean(identity?.contract_implemented && identity?.configured)}
              status={identity?.status || "not configured"}
            />
            <Requirement
              title="Live face / liveness"
              description="A live biometric check establishes physical presence. SafariPlug does not treat a profile photo or uploaded selfie as proof of liveness."
              ready={Boolean(liveness?.contract_implemented && liveness?.configured)}
              status={liveness?.status || "not configured"}
            />
          </div>

          <TravelerVerificationStart
            hasCase={Boolean(current)}
            status={verified ? "approved" : current?.status || null}
          />
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Where SafariPlug uses this gate</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <TrustUse title="Specific drivers" body="Required before requesting a named driver for a transfer." />
            <TrustUse title="Personal services" body="Required before confirming appointments with service specialists." />
            <TrustUse title="Connected transfer & activity checkout" body="Required before starting payment for Hotelbeds transfers and activities." />
          </div>
        </section>
      </section>
    </main>
  );
}

function Requirement({
  title,
  description,
  ready,
  status,
}: {
  title: string;
  description: string;
  ready: boolean;
  status: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-black/50">{description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {ready ? "Connected" : "Pending"}
        </span>
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-black/30">
        Adapter: {status}
      </p>
    </div>
  );
}

function TrustUse({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f7f4] p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-black/50">{body}</p>
    </div>
  );
}
