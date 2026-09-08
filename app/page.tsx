import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LOCATIONS } from "@/lib/constants/locations";
import LuxuryImage from "@/components/LuxuryImage";

export const dynamic = "force-dynamic";

const destinations = LOCATIONS.map((location) => [location.name, location.description, location.query]);

const categories = [
  ["Hotels", "Stay somewhere worth remembering", "/hotels", "🏨"],
  ["Experiences", "Tours, adventures and local discoveries", "/events?type=experiences", "✦"],
  ["Events", "Music, culture, nightlife and what’s on", "/events", "◉"],
  ["Services", "Barbers, massage, beauty, wellness and more", "/services", "✧"],
  ["Restaurants", "Find food, order delivery and track it", "/restaurants", "⌁"],
  ["Trips", "Build one itinerary for everything you book", "/account", "▱"],
];

const categoryImages: Record<string, string> = {
  Hotels: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
  Experiences: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=85",
  Events: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85",
  Services: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=85",
  Restaurants: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
  Trips: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=85",
};

const interestImages: Record<string, string> = {
  "Music & Nightlife": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85",
  "Food & Drink": "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
  Beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  Safari: "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=85",
  Adventure: "https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=1200&q=85",
  Culture: "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1200&q=85",
};

const interests = [
  ["Music & Nightlife", "DJs, live music, parties and late nights", "Music%20%26%20Nightlife"],
  ["Food & Drink", "Restaurants, dinners, cocktails and food spots", "Food%20%26%20Drink"],
  ["Beach", "Beach clubs, ocean days and coastal escapes", "Beach"],
  ["Safari", "Wildlife, lodges and unforgettable escapes", "Safari%20%26%20Wildlife"],
  ["Adventure", "Outdoor experiences, nature and adrenaline", "Adventure"],
  ["Culture", "Art, heritage, communities and local life", "Culture%20%26%20Arts"],
];

export default async function HomePage() {
  const now = new Date().toISOString();
  const validity = `end_at.gte.${now},and(end_at.is.null,start_at.gte.${now})`;
  const kenyaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
  const startTonight = new Date(`${kenyaDate}T18:00:00+03:00`);
  const endTonight = new Date(`${kenyaDate}T23:59:59+03:00`);
  const select = "id,title,description,category,start_at,end_at,venue_name,price,currency,image_url";

  let { data: featuredEvent } = await supabase.from("events").select(select).eq("status", "approved").eq("is_featured", true).or(validity).order("start_at", { ascending: true }).limit(1).maybeSingle();
  if (!featuredEvent) {
    const { data } = await supabase.from("events").select(select).eq("status", "approved").or(validity).order("start_at", { ascending: true }).limit(1).maybeSingle();
    featuredEvent = data;
  }
  const { data: tonightEvents } = await supabase.from("events").select(select).eq("status", "approved").gte("start_at", startTonight.toISOString()).lte("start_at", endTonight.toISOString()).or(validity).order("start_at", { ascending: true }).limit(3);
  const { data: upcomingEvents } = await supabase.from("events").select(select).eq("status", "approved").or(validity).order("start_at", { ascending: true }).limit(3);

  return (
    <main className="min-h-screen bg-[#070708] text-[#f4f0e8] selection:bg-[#c9a86a] selection:text-[#070708]">
      <header className="absolute inset-x-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center"><img src="/brand/safariplug-wordmark-light.png" alt="SafariPlug" className="h-9 w-auto" /></Link>
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/events" className="text-sm font-semibold text-white/80 hover:text-white">Discover</Link>
            <Link href="/hotels" className="text-sm font-semibold text-white/80 hover:text-white">Hotels</Link>
            <Link href="/services" className="text-sm font-semibold text-white/80 hover:text-white">Services</Link>
            <Link href="/account" className="text-sm font-semibold text-white/80 hover:text-white">My SafariPlug</Link>
            <Link href="/submit" className="rounded-full border border-[#c9a86a]/50 bg-[#c9a86a]/10 px-5 py-2.5 text-sm font-bold text-[#e7c98d] backdrop-blur hover:bg-[#c9a86a] hover:text-[#070708]">List Your Business</Link>
          </nav>
        </div>
      </header>

      <section className="relative flex min-h-[850px] items-end overflow-hidden">
        <LuxuryImage src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2200&q=90" alt="East Africa" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/55" /><div className="absolute inset-0 bg-gradient-to-r from-[#070708]/95 via-[#070708]/55 to-transparent" /><div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-transparent to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 lg:px-10 lg:pb-28">
          <div className="max-w-5xl">
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-[#c9a86a]/40 bg-black/30 px-5 py-2.5 text-xs font-black uppercase tracking-[0.28em] text-[#e7c98d] backdrop-blur-md"><span className="h-2 w-2 rounded-full bg-[#c9a86a]" />SafariPlug Intelligence</div>
            <h1 className="font-serif text-6xl font-medium leading-[.9] tracking-[-.04em] text-white sm:text-7xl lg:text-[104px]">Your AI concierge<br />for Africa.</h1>
            <p className="mt-8 max-w-2xl text-xl leading-9 text-white/70">Tell SafariPlug what you want to do, where you want to go, or what you need. We discover it, help you book it, and keep it together in your trip.</p>
            <div className="mt-10 rounded-[2rem] border border-white/15 bg-black/35 p-3 shadow-2xl backdrop-blur-xl sm:flex sm:items-center">
              <div className="flex-1 px-5 py-4"><p className="text-xs font-black uppercase tracking-[0.25em] text-[#e7c98d]">Ask SafariPlug</p><p className="mt-1 text-sm text-white/55">“Find me a great barber in Nairobi tomorrow”</p></div>
              <Link href="/concierge" className="mt-2 block rounded-full bg-[#e7c98d] px-7 py-4 text-center text-sm font-black text-[#070708] hover:bg-[#f0d9a4] sm:mt-0">Ask AI Concierge →</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/hotels" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80">🏨 Hotels</Link><Link href="/events" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80">✦ Experiences & Events</Link><Link href="/services" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80">✧ Services</Link><Link href="/restaurants" className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80">⌁ Food</Link></div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0d0d0f] py-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 lg:px-10"><span className="mr-2 text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Explore</span>{[["Tonight","/events?when=tonight"],["This weekend","/events?when=this-weekend"],["Hotels","/hotels"],["Services","/services"],["Restaurants","/restaurants"],["My SafariPlug","/account"]].map(([label,href])=><Link key={label} href={href} className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-bold text-white/70 hover:border-[#c9a86a]/60 hover:text-[#e7c98d]">{label}</Link>)}</div></section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">One place. Everything you need.</p><h2 className="mt-4 max-w-3xl font-serif text-5xl font-medium tracking-tight sm:text-6xl">Discover it. Book it. Keep it together.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-white/50">SafariPlug connects discovery, bookings, payments and your itinerary so you can stop jumping between apps.</p><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map(([title,text,href,icon])=><Link key={title} href={href} className="group relative min-h-[260px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#111114] p-7"><LuxuryImage src={categoryImages[title]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 transition duration-700 group-hover:scale-105 group-hover:opacity-50"/><div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"/><div className="relative z-10 flex h-full flex-col justify-between"><span className="text-2xl">{icon}</span><div><h3 className="font-serif text-3xl font-medium">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-white/65">{text}</p><span className="mt-5 inline-block text-sm font-bold text-[#e7c98d]">Explore →</span></div></div></Link>)}</div></section>

      <section className="border-y border-white/10 bg-[#0b0b0d] py-24"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Live discovery</p><h2 className="font-serif text-5xl font-medium tracking-tight">What’s happening tonight?</h2><p className="mt-4 max-w-xl text-white/45">Fresh events and experiences surfaced by SafariPlug Intelligence.</p></div><Link href="/events?when=tonight" className="font-bold text-[#e7c98d] underline underline-offset-4">View tonight →</Link></div><div className="mt-10 grid gap-4 md:grid-cols-3">{(tonightEvents?.length ? tonightEvents : upcomingEvents || []).map((event)=><Link key={event.id} href={`/events/${event.id}`} className="group relative min-h-[260px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111114]"><LuxuryImage src={event.image_url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"/><div className="absolute bottom-0 z-10 p-6"><span className="text-[10px] font-black uppercase tracking-[.25em] text-[#e7c98d]">{event.category || "Discovery"}</span><h3 className="mt-2 font-serif text-2xl font-medium">{event.title}</h3><p className="mt-1 text-sm text-white/50">{event.venue_name}</p></div></Link>)}</div></div></section>

      {featuredEvent && <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Selected by SafariPlug AI</p><Link href={`/events/${featuredEvent.id}`} className="group relative mt-8 block min-h-[480px] overflow-hidden rounded-[2rem] border border-white/10"><LuxuryImage src={featuredEvent.image_url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=85"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-105"/><div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent"/><div className="absolute bottom-0 z-10 max-w-3xl p-8 sm:p-12"><span className="rounded-full border border-[#c9a86a]/50 bg-[#c9a86a]/10 px-4 py-2 text-xs font-black uppercase tracking-[.2em] text-[#e7c98d]">{featuredEvent.category || "Featured discovery"}</span><h2 className="mt-6 font-serif text-4xl font-medium sm:text-6xl">{featuredEvent.title}</h2><p className="mt-4 text-lg leading-8 text-white/70">{featuredEvent.description || "A discovery worth experiencing."}</p></div></Link></section>}

      <section className="border-y border-white/10 bg-[#0d0d10] py-24"><div className="mx-auto max-w-7xl px-6 lg:px-10"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Explore by interest</p><h2 className="mt-4 font-serif text-5xl font-medium">What are you into?</h2><div className="mt-12 grid gap-5 md:grid-cols-3">{interests.map(([title,description,category],i)=><Link key={title} href={`/events?category=${category}`} className="group relative min-h-[300px] overflow-hidden rounded-[2rem] border border-white/10"><LuxuryImage src={interestImages[title]} alt={title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"/><div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent"/><div className="relative z-10 flex h-full flex-col justify-end p-7"><span className="text-xs font-black tracking-[.2em] text-[#e7c98d]">0{i+1}</span><h3 className="mt-4 font-serif text-3xl font-medium">{title}</h3><p className="mt-2 text-white/70">{description}</p></div></Link>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10"><p className="text-xs font-black uppercase tracking-[0.3em] text-[#c9a86a]">Explore by destination</p><h2 className="mt-4 font-serif text-5xl font-medium">Where are you going?</h2><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{destinations.map(([name,description,query],i)=><Link key={name} href={`/events?${query}`} className="rounded-[1.5rem] border border-white/10 bg-[#111114] p-6 transition hover:-translate-y-1 hover:border-[#c9a86a]/50"><span className="text-xs font-black tracking-[.2em] text-[#e7c98d]">0{i+1}</span><h3 className="mt-10 font-serif text-2xl font-medium">{name}</h3><p className="mt-2 text-sm text-white/45">{description}</p></Link>)}</div></section>

      <section className="border-y border-[#c9a86a]/20 bg-[#151316] py-24"><div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:px-10"><div><p className="text-xs font-black uppercase tracking-[.3em] text-[#c9a86a]">SafariPlug Intelligence</p><h2 className="mt-5 font-serif text-5xl font-medium leading-tight sm:text-6xl">The internet is noisy.<br/>We find what’s worth doing.</h2></div><div className="flex flex-col justify-end"><p className="text-lg leading-8 text-white/55">From a hotel room to a last-minute massage, a restaurant delivery to tonight’s best event, SafariPlug helps you discover and book the right thing without the usual search.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/concierge" className="rounded-full bg-[#e7c98d] px-8 py-4 font-bold text-[#070708]">Ask the Concierge →</Link><Link href="/account" className="rounded-full border border-white/15 px-8 py-4 font-bold text-white">My SafariPlug</Link></div></div></div></section>

      <section className="bg-[#0b0b0d] py-24 text-center"><div className="mx-auto max-w-4xl px-6"><p className="text-xs font-black uppercase tracking-[.3em] text-[#c9a86a]">For businesses</p><h2 className="mt-5 font-serif text-5xl font-medium">Get discovered. Get booked. Grow.</h2><p className="mx-auto mt-6 max-w-2xl text-white/60">List your hotel, restaurant, service, tour, event or experience and reach travelers and locals looking for their next thing.</p><Link href="/submit" className="mt-10 inline-flex rounded-full bg-[#e7c98d] px-9 py-4 font-black text-[#070708]">List Your Business →</Link></div></section>

      <footer className="border-t border-white/10 bg-[#070708] px-6 py-14 text-white"><div className="mx-auto max-w-7xl"><img src="/brand/safariplug-wordmark-light.png" alt="SafariPlug" className="h-9"/><p className="mt-5 max-w-md text-sm leading-6 text-white/45">Discover, book and experience more across Africa.</p><div className="mt-10 flex flex-wrap gap-7 text-sm uppercase tracking-[.18em] text-white/50"><Link href="/events">Discover</Link><Link href="/hotels">Hotels</Link><Link href="/services">Services</Link><Link href="/account">My SafariPlug</Link><Link href="/submit">Businesses</Link></div><div className="mt-10 border-t border-white/10 pt-6 text-xs uppercase tracking-[.2em] text-white/25">© 2026 SafariPlug. Discover more. Experience more.</div></div></footer>
    </main>
  );
}
