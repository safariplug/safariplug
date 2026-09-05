import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function DriverApplicationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/driver/login");

  const { data: driver } = await supabaseAdmin
    .from("driver_profiles")
    .select("id, display_name, service_status, verification_state, service_city, service_country, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!driver) {
    return (
      <main className="min-h-screen bg-[#070708] px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <h1 className="text-2xl font-black">No driver application found</h1>
          <p className="mt-3 text-zinc-500">This account is not linked to a driver application.</p>
          <Link href="/driver/signup" className="mt-6 inline-block text-[#c9a86a]">Apply to drive →</Link>
        </div>
      </main>
    );
  }

  const { data: verification } = await supabaseAdmin
    .from("verification_cases")
    .select("status, verification_level, provider, rejection_reason, notes, expires_at")
    .eq("subject_type", "driver")
    .eq("subject_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("category, make_model, passenger_capacity, luggage_capacity, status")
    .eq("driver_id", driver.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const verified = driver.verification_state === "verified" && driver.service_status === "active";
  const statusLabel = verified ? "Approved & active" : driver.service_status === "rejected" || driver.verification_state === "rejected" ? "Needs attention" : "Pending review";

  return (
    <main className="min-h-screen bg-[#070708] text-white">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-[#c9a86a]">Plug</span></Link>
          <span className="font-mono text-xs text-zinc-500">Driver portal</span>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#c9a86a]">Application</p><h1 className="mt-2 text-4xl font-black">Welcome, {driver.display_name}</h1><p className="mt-2 text-zinc-500">{driver.service_city}, {driver.service_country}</p></div>
          <div className="rounded-full border border-zinc-700 px-4 py-2 font-mono text-xs text-[#c9a86a]">{statusLabel}</div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Application", driver.service_status === "pending" ? "Submitted" : driver.service_status],
            ["Verification", driver.verification_state],
            ["Bookable", verified ? "Yes" : "No"],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-2 font-semibold">{value}</p></div>)}
        </div>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
          <h2 className="text-xl font-bold">Verification</h2>
          <p className="mt-3 leading-7 text-zinc-400">SafariPlug requires identity and driving-document review plus mandatory live face/liveness verification before a driver can receive or accept assignments.</p>
          <div className="mt-5 rounded-2xl border border-[#c9a86a]/20 bg-[#c9a86a]/5 p-4 text-sm text-zinc-300">
            <div className="font-semibold text-white">Current verification status: {verification?.status ?? "not started"}</div>
            <div className="mt-1 text-zinc-500">Level: {verification?.verification_level ?? "enhanced"} · Provider: {verification?.provider ?? "human review"}</div>
            {verification?.rejection_reason ? <div className="mt-2 text-red-300">Reason: {verification.rejection_reason}</div> : null}
          </div>
          <p className="mt-4 text-xs text-zinc-600">Verification evidence is handled through the secure onboarding/review workflow. Do not send identity documents by email or through public forms.</p>
        </section>

        {vehicle ? <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><h2 className="font-bold">Vehicle on application</h2><p className="mt-2 text-sm text-zinc-400">{vehicle.make_model || vehicle.category} · {vehicle.passenger_capacity ?? "—"} passengers · {vehicle.luggage_capacity ?? "—"} luggage</p><p className="mt-1 text-xs text-zinc-600">Status: {vehicle.status}</p></section> : null}

        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="font-bold">What happens next?</h2>
          <ol className="mt-4 space-y-3 text-sm text-zinc-400"><li>1. SafariPlug reviews your application and service details.</li><li>2. You complete the required verification and live liveness check when invited.</li><li>3. Your vehicle and service eligibility are reviewed.</li><li>4. Only after approval can your driver profile become active and bookable.</li></ol>
        </section>
      </section>
    </main>
  );
}
