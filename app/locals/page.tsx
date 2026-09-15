import Link from "next/link";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

const interests = [
  ["Nightlife", "Clubs, lounges, live music and the right places for the night."],
  ["Food & culture", "Local restaurants, markets, neighborhoods and cultural context."],
  ["Hidden gems", "Places a visitor is unlikely to discover from a generic itinerary."],
  ["Shopping", "Markets, designers, crafts, fashion and local buying guidance."],
  ["Photography", "Explore photogenic places with someone who knows the city."],
  ["Beach & outdoors", "Local beach days, walks and outdoor social experiences."],
  ["Business & networking", "Local context for founders, professionals and business travelers."],
  ["City companion", "A flexible local companion for a personalized day in the city."],
];

export default function LocalsPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#111] text-white">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16">
          <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug / Locals</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">Meet the city through a local.<br/><span className="text-white/40">People, not generic itineraries.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Find local companions by city, interests and the kind of experience you want. SafariPlug is building this marketplace around identity, personal profiles and traveler safety—not anonymous listings.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/concierge?q=${encodeURIComponent("Help me find a local companion")}`} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">Request a local →</Link>
            <Link href="/services" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">Explore services</Link>
          </div>
        </div>
      </section>
      <DiscoverySwitcher current="/locals" />

      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[1.75rem] bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8b672f]">Personal</p><h2 className="mt-3 text-xl font-semibold">Choose the person</h2><p className="mt-2 text-sm leading-6 text-black/50">Profiles will surface a real photo, bio, city, languages, interests, specialties, availability and rates when those records are verified and live.</p></div>
          <div className="rounded-[1.75rem] bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8b672f]">Verified</p><h2 className="mt-3 text-xl font-semibold">Trust before discovery</h2><p className="mt-2 text-sm leading-6 text-black/50">The public marketplace will only expose locals who pass the required SafariPlug verification and activation gates. Verification is a trust signal, not a guarantee of personal safety.</p></div>
          <div className="rounded-[1.75rem] bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8b672f]">Connected</p><h2 className="mt-3 text-xl font-semibold">Part of your trip</h2><p className="mt-2 text-sm leading-6 text-black/50">A local request is designed to sit alongside stays, drivers, services, food and experiences inside My SafariPlug as the booking system expands.</p></div>
        </div>

        <div className="mt-14 flex items-end justify-between gap-6"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Find your person</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">What do you want a local for?</h2></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {interests.map(([title, description]) => <Link key={title} href={`/concierge?q=${encodeURIComponent(`Find me a verified local for ${title}`)}`} className="group rounded-[1.5rem] border border-black/8 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/20"><div className="flex items-center justify-between"><h3 className="font-semibold">{title}</h3><span className="text-black/30 transition group-hover:translate-x-1">→</span></div><p className="mt-3 text-sm leading-6 text-black/50">{description}</p></Link>)}
        </div>

        <div className="mt-14 rounded-[2rem] border border-amber-900/10 bg-[#eee7d9] p-7 sm:p-9"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#7a5b29]">Marketplace status</p><h2 className="mt-3 text-2xl font-semibold">We will not invent local profiles.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-black/55">SafariPlug does not yet have verified public Local profiles in the canonical backend. Until the Local onboarding, verification, availability and request records are implemented, requests go through Concierge instead of showing fake people, rates, reviews or availability.</p><Link href={`/concierge?q=${encodeURIComponent("I want a local companion. Help me plan what I need.")}`} className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Start with Concierge →</Link></div>
      </section>
    </main>
  );
}
