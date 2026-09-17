import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LuxuryImage from "@/components/LuxuryImage";
import SmartFind from "@/components/SmartFind";

export const dynamic = "force-dynamic";

const quickFind = [
  ["Experiences", "Things to do", "/experiences", "✦"],
  ["Transfers", "Rides & pickups", "/transfers", "↗"],
  ["Hotels", "Places to stay", "/hotels", "▦"],
  ["Services", "Barber, massage & more", "/services", "✧"],
  ["Food", "Restaurants & dining", "/restaurants", "⌁"],
  ["Events", "What’s happening", "/events", "◉"],
  ["Trips", "Your itinerary", "/account/trips", "▱"],
  ["Ask AI", "Tell us what you need", "/concierge", "✺"],
];

const platformAreas = [
  { title: "Experiences", text: "Tours, nightlife, beaches, safari, food, live music and hidden gems.", href: "/experiences", image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=85" },
  { title: "Drivers & Transfers", text: "Airport pickups, event transport, safari transfers and driver requests.", href: "/transfers", image: "https://images.unsplash.com/photo-1515569067071-ec3b51335dd0?auto=format&fit=crop&w=1200&q=85" },
  { title: "Hotels", text: "Find stays and move into connected availability when providers are ready.", href: "/hotels", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85" },
  { title: "Local Services", text: "Barbers, massage, beauty, wellness and other trusted local professionals.", href: "/services", image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=85" },
];

export default async function HomePage() {
  const now = new Date().toISOString();
  const validity = `end_at.gte.${now},and(end_at.is.null,start_at.gte.${now})`;
  const { data: upcomingEvents } = await supabase.from("events").select("id,title,category,venue_name,image_url,start_at").eq("status", "approved").or(validity).order("start_at", { ascending: true }).limit(3);

  return (
    <main className="min-h-screen bg-[#070708] text-[#f4f0e8] selection:bg-[#c9a86a] selection:text-[#070708]">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8 lg:px-10">
          <Link href="/" className="flex items-center"><img src="/brand/safariplug-wordmark-light.png" alt="SafariPlug" className="h-9 w-auto" /></Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/experiences" className="text-sm font-semibold text-white/75 hover:text-white">Experiences</Link><Link href="/drivers" className="text-sm font-semibold text-white/75 hover:text-white">Drivers</Link><Link href="/hotels" className="text-sm font-semibold text-white/75 hover:text-white">Hotels</Link><Link href="/services" className="text-sm font-semibold text-white/75 hover:text-white">Services</Link><Link href="/events" className="text-sm font-semibold text-white/75 hover:text-white">Events</Link><Link href="/account" className="text-sm font-semibold text-white/75 hover:text-white">My SafariPlug</Link>
          </nav>
        </div>
      </header>

      <section className="relative flex min-h-[700px] items-end overflow-hidden md:min-h-[790px]">
        <LuxuryImage src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=2200&q=90" alt="Travel across Africa" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/55" /><div className="absolute inset-0 bg-gradient-to-r from-[#070708]/95 via-[#070708]/65 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-transparent to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-12 md:px-8 md:pb-16 lg:px-10">
          <div className="max-w-5xl">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#c9a86a]/40 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#e7c98d] backdrop-blur-md">One SafariPlug. Your whole trip.</div>
            <h1 className="max-w-5xl font-serif text-5xl font-medium leading-[.94] tracking-[-.04em] text-white sm:text-7xl lg:text-[88px]">Find what you need in Africa — fast.</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70 md:text-xl">Experiences, drivers, hotels, services, food and events — all from one starting point.</p>
            <SmartFind />
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto -mt-2 max-w-7xl px-4 pb-16 md:px-8 lg:px-10">
        <div className="rounded-[2rem] border border-white/10 bg-[#0d0d10]/95 p-4 shadow-2xl backdrop-blur-xl md:p-6">
          <div className="mb-4 px-1"><p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">Quick find</p><h2 className="mt-2 font-serif text-3xl font-medium text-white md:text-4xl">Or choose what you need.</h2></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{quickFind.map(([title, subtitle, href, icon]) => <Link key={title} href={href} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#c9a86a]/50 hover:bg-[#c9a86a]/5 md:p-5"><div className="flex items-center justify-between"><span className="text-2xl text-[#e7c98d]">{icon}</span><span className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#e7c98d]">→</span></div><h3 className="mt-5 text-base font-black text-white md:text-lg">{title}</h3><p className="mt-1 text-xs leading-5 text-white/45 md:text-sm">{subtitle}</p></Link>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20 lg:px-10">
        <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Explore SafariPlug</p><h2 className="mt-4 font-serif text-4xl font-medium tracking-tight text-white sm:text-5xl">Everything for the trip.</h2><p className="mt-4 text-lg leading-8 text-white/50">Start with the category that matches what you need right now.</p></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{platformAreas.map((area) => <Link key={area.title} href={area.href} className="group relative min-h-[300px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#111114] p-6"><LuxuryImage src={area.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 transition duration-700 group-hover:scale-105 group-hover:opacity-45" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" /><div className="relative z-10 flex h-full flex-col justify-end"><h3 className="font-serif text-3xl font-medium text-white">{area.title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{area.text}</p><span className="mt-5 text-sm font-bold text-[#e7c98d]">Explore →</span></div></Link>)}</div>
      </section>

      <section className="border-y border-white/10 bg-[#0d0d10] py-16 md:py-20"><div className="mx-auto grid max-w-7xl gap-5 px-5 md:grid-cols-2 md:px-8 lg:px-10">
        <div className="rounded-[1.8rem] border border-white/10 bg-[#111114] p-7 md:p-9"><p className="text-xs font-black uppercase tracking-[0.25em] text-[#c9a86a]">Drivers & transfers</p><h2 className="mt-4 font-serif text-4xl font-medium text-white">Need a ride, pickup or transfer?</h2><p className="mt-4 leading-7 text-white/55">Request airport transfers, event transport, safari transfers or a specific driver when available.</p><Link href="/transfers" className="mt-6 inline-flex rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/10 px-5 py-3 text-sm font-bold text-[#e7c98d]">Transfers →</Link></div>
        <div className="rounded-[1.8rem] border border-white/10 bg-[#111114] p-7 md:p-9"><p className="text-xs font-black uppercase tracking-[0.25em] text-[#c9a86a]">Personal services</p><h2 className="mt-4 font-serif text-4xl font-medium text-white">Need a barber, massage or local professional?</h2><p className="mt-4 leading-7 text-white/55">Find services that are useful during a real trip, not just tourist attractions.</p><Link href="/services" className="mt-6 inline-flex rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/10 px-5 py-3 text-sm font-bold text-[#e7c98d]">Browse services →</Link></div>
      </div></section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20 lg:px-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Happening now</p><h2 className="mt-4 font-serif text-4xl font-medium text-white sm:text-5xl">Upcoming events</h2><p className="mt-3 max-w-2xl text-white/45">Events remain easy to find, without dominating the whole SafariPlug experience.</p></div><Link href="/events" className="font-bold text-[#e7c98d] underline underline-offset-4">See all events →</Link></div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">{(upcomingEvents || []).map((event) => <Link key={event.id} href={`/events/${event.id}`} className="group relative min-h-[250px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111114]"><LuxuryImage src={event.image_url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-48 transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" /><div className="absolute bottom-0 z-10 p-6"><span className="text-[10px] font-black uppercase tracking-[.25em] text-[#e7c98d]">{event.category || "Discovery"}</span><h3 className="mt-2 font-serif text-2xl font-medium text-white">{event.title}</h3><p className="mt-1 text-sm text-white/50">{event.venue_name}</p></div></Link>)}</div>
      </section>

      <section className="border-t border-white/10 bg-[#0d0d0f] py-16 md:py-20"><div className="mx-auto max-w-5xl px-5 text-center md:px-8"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Still deciding?</p><h2 className="mt-4 font-serif text-4xl font-medium text-white sm:text-5xl">Just tell SafariPlug what you want.</h2><p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/50">The AI Concierge gives people one fast route when they do not know which category to open.</p><Link href="/concierge" className="mt-7 inline-flex rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708] hover:bg-[#f0d9a4]">Ask SafariPlug AI →</Link></div></section>
    </main>
  );
}
