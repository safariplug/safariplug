import Link from "next/link";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const interests = ["Nightlife", "Food & culture", "Hidden gems", "Shopping", "Photography", "Beach & outdoors", "Business & networking", "City companion"];

export default async function LocalsPage() {
  const { data } = await supabaseAdmin.from("local_profiles").select("id,display_name,bio,personal_photo_url,city,country,languages,interests,specialties,hourly_rate,currency,verification_state,service_status").eq("service_status", "active").eq("verification_state", "verified").order("created_at", { ascending: false }).limit(30);
  const locals = data ?? [];

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="bg-[#111] text-white"><div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16">
      <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug / Locals</p>
      <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">Meet the city through a local.<br/><span className="text-white/40">People, not generic itineraries.</span></h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Browse activated, verified local companions by city, language and interests. Public profiles only appear after SafariPlug verification.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/locals/onboarding" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">Become a SafariPlug Local →</Link><Link href={`/concierge?q=${encodeURIComponent("Help me find a local companion")}`} className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold">Ask Concierge</Link></div>
    </div></section>
    <DiscoverySwitcher current="/locals" />
    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10">
      <div className="flex items-end justify-between gap-6"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Verified locals</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Choose your person</h2></div><p className="text-sm text-black/45">{locals.length} available profile{locals.length === 1 ? "" : "s"}</p></div>
      {locals.length ? <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{locals.map((local) => <article key={local.id} className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm">
        {local.personal_photo_url ? <img src={local.personal_photo_url} alt={`${local.display_name} profile`} className="h-64 w-full object-cover" /> : <div className="flex h-64 items-center justify-center bg-black text-5xl font-semibold text-white">{local.display_name.slice(0,1).toUpperCase()}</div>}
        <div className="p-6"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{local.display_name}</h3><span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">✓ Verified</span></div>
        <p className="mt-1 text-sm text-black/45">{[local.city, local.country].filter(Boolean).join(", ") || "Location available on request"}</p>{local.bio && <p className="mt-4 line-clamp-3 text-sm leading-6 text-black/60">{local.bio}</p>}
        {!!local.languages?.length && <p className="mt-4 text-xs text-black/50"><b>Languages:</b> {local.languages.join(" · ")}</p>}{!!local.interests?.length && <div className="mt-4 flex flex-wrap gap-2">{local.interests.slice(0,5).map((x:string)=><span key={x} className="rounded-full bg-[#f2f0e9] px-3 py-1 text-xs">{x}</span>)}</div>}
        <div className="mt-5 flex items-center justify-between"><p className="text-sm font-semibold">{local.hourly_rate != null ? `${local.currency} ${Number(local.hourly_rate).toLocaleString()}/hr` : "Rate on request"}</p><Link href={`/locals/${local.id}`} className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">View & request →</Link></div></div>
      </article>)}</div> : <div className="mt-7 rounded-[2rem] border border-amber-900/10 bg-[#eee7d9] p-8"><h3 className="text-2xl font-semibold">Verified locals are onboarding.</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">The backend is live, but SafariPlug will not invent profiles. A Local only appears here after completing a personal profile and passing the activation and verification gates.</p></div>}
      <div className="mt-14"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Explore by interest</p><div className="mt-5 flex flex-wrap gap-2">{interests.map(x=><Link key={x} href={`/concierge?q=${encodeURIComponent(`Find me a verified local for ${x}`)}`} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold">{x}</Link>)}</div></div>
    </section>
  </main>;
}
