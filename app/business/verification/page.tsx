import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { describeVerificationProviders } from "@/lib/integrations/verification";
import VerificationStart from "./VerificationStart";

export const dynamic = "force-dynamic";

function tone(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["rejected", "revoked", "expired"].includes(status)) return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function ProviderVerificationPage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) redirect("/login?next=/business/verification");

  const [{ data: business }, { data: current }, providers] = await Promise.all([
    supabaseAdmin.from("businesses").select("id,name,verified,claimed,status").eq("owner_id", user.id).in("status", ["active", "ACTIVE"]).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("verification_cases").select("id,status,verification_level,provider,external_id,reviewed_at,expires_at,rejection_reason,notes,created_at,updated_at").eq("subject_type", "provider").eq("subject_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    describeVerificationProviders(),
  ]);

  const liveness = providers.find((p) => p.key === "liveness_provider");
  const identity = providers.find((p) => p.key === "identity_provider");
  const payoutReady = Boolean(current?.status === "approved" && (!current.expires_at || new Date(current.expires_at) > new Date()));

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <header className="border-b border-black/8 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10"><div><Link href="/" className="text-sm font-semibold">SafariPlug</Link><p className="mt-1 text-[10px] uppercase tracking-[.25em] text-black/35">Partner trust</p></div><div className="flex gap-2"><Link href="/business/services" className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold">Workspace</Link><Link href="/business/payouts" className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">Earnings</Link></div></div></header>
      <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10"><div className="max-w-3xl"><p className="text-[11px] font-semibold uppercase tracking-[.25em] text-black/40">Provider verification</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">Trust before payout.</h1><p className="mt-4 text-base leading-7 text-black/50">SafariPlug requires verified provider identity and live face/liveness evidence before provider payouts can be released. The verification system never treats a client-side claim as proof.</p></div>
        {!business ? <div className="mt-10 rounded-[2rem] bg-white p-8 shadow-sm"><h2 className="text-xl font-semibold">Create your service business first</h2><p className="mt-2 max-w-xl text-sm leading-6 text-black/50">Your verification case is tied to your authenticated provider account, so we first need a service business on the account.</p><Link href="/business/services" className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">Open partner workspace</Link></div> : <>
          <section className="mt-10 grid gap-4 md:grid-cols-3"><div className="rounded-[1.75rem] bg-black p-6 text-white"><p className="text-[10px] uppercase tracking-[.22em] text-white/45">Provider</p><p className="mt-3 text-xl font-semibold">{business.name}</p><p className="mt-1 text-xs text-white/45">{business.verified ? "Business verified" : "Business verification pending"}</p></div><div className="rounded-[1.75rem] bg-white p-6 shadow-sm"><p className="text-[10px] uppercase tracking-[.22em] text-black/40">Verification</p><p className="mt-3 text-xl font-semibold">{current?.status || "Not started"}</p><p className="mt-1 text-xs text-black/45">Enhanced provider verification</p></div><div className="rounded-[1.75rem] bg-white p-6 shadow-sm"><p className="text-[10px] uppercase tracking-[.22em] text-black/40">Payout eligibility</p><p className="mt-3 text-xl font-semibold">{payoutReady ? "Eligible" : "Blocked"}</p><p className="mt-1 text-xs text-black/45">Identity + liveness required</p></div></section>
          {current ? <section className={`mt-6 rounded-[1.75rem] border p-6 ${tone(current.status)}`}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] opacity-60">Current case</p><h2 className="mt-2 text-xl font-semibold">{current.status.replaceAll("_", " ")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 opacity-75">{current.rejection_reason || current.notes || "Your verification case is being prepared."}</p></div><span className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-semibold">{current.verification_level}</span></div></section> : null}
          <section className="mt-6 rounded-[2rem] bg-white p-7 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-black/40">Required evidence</p><h2 className="mt-2 text-2xl font-semibold">Two trust signals.</h2></div><span className="rounded-full bg-black/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">No payout without both</span></div><div className="mt-7 grid gap-4 md:grid-cols-2"><Requirement title="Identity verification" description="Government identity evidence is reviewed and linked to your provider account. SafariPlug stores only opaque references in its verification records." ready={Boolean(identity?.contract_implemented && identity?.configured)} status={identity?.status || "not configured"} /><Requirement title="Live face / liveness" description="A live biometric check must establish that the person completing verification is physically present. A selfie upload alone does not satisfy this requirement." ready={Boolean(liveness?.contract_implemented && liveness?.configured)} status={liveness?.status || "not configured"} /></div><div className="mt-6 rounded-2xl bg-[#f7f7f4] p-5"><p className="text-sm font-semibold">What is connected today?</p><p className="mt-2 text-sm leading-6 text-black/50">The verification adapter layer and database case workflow are live, but no external identity/liveness provider is currently connected. We will not simulate a successful face check or mark evidence accepted manually from this page.</p></div><VerificationStart hasCase={Boolean(current)} status={current?.status || null} /></section>
          <section className="mt-6 rounded-[2rem] bg-white p-7 shadow-sm"><h2 className="text-xl font-semibold">Why this matters</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><div><p className="font-semibold">Protect customers</p><p className="mt-1 text-sm leading-6 text-black/50">Reduce impersonation and unsafe-provider risk before money moves.</p></div><div><p className="font-semibold">Protect providers</p><p className="mt-1 text-sm leading-6 text-black/50">Keep a durable verification record and clear payout gate.</p></div><div><p className="font-semibold">Protect SafariPlug</p><p className="mt-1 text-sm leading-6 text-black/50">Keep approval decisions evidence-based and auditable.</p></div></div></section>
        </>}
      </section>
    </main>
  );
}

function Requirement({ title, description, ready, status }: { title: string; description: string; ready: boolean; status: string }) { return <div className="rounded-2xl border border-black/8 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-black/50">{description}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{ready ? "Connected" : "Pending"}</span></div><p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-black/30">Adapter: {status}</p></div>; }
