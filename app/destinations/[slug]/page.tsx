import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDestinationMarket } from "@/lib/destinations/market";

export const dynamic="force-dynamic";

export default async function DestinationPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const market=await loadDestinationMarket(slug);
  if(!market)notFound();
  const q=encodeURIComponent(market.city.name);
  return <main className="min-h-screen bg-[#070708] text-[#f4f0e8]">
    <section className="border-b border-white/10"><div className="mx-auto max-w-7xl px-5 py-16 md:px-8 lg:px-10"><Link href="/destinations" className="text-sm font-semibold text-[#e7c98d]">← Destinations</Link><p className="mt-10 text-xs font-black uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug destination</p><div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><h1 className="font-serif text-6xl font-medium tracking-tight text-white md:text-8xl">{market.city.name}</h1><p className="mt-3 text-lg text-white/50">{market.city.country}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.04] px-5 py-4"><p className="text-xs uppercase tracking-wider text-white/40">Direct SafariPlug density</p><p className="mt-1 text-3xl font-semibold capitalize">{market.density}</p><p className="mt-1 text-xs text-white/45">{market.directTotal} active direct options across local categories</p></div></div><p className="mt-8 max-w-3xl text-lg leading-8 text-white/60">Start with real local supply already active on SafariPlug, then use live supplier searches for accommodation, activities and transfers. SafariPlug does not treat external supplier inventory as locally activated direct supply.</p></div></section>

    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 lg:px-10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
        ["Services",market.counts.services,"/services?q="+q],
        ["Events",market.counts.events,"/events?q="+q],
        ["Restaurants",market.counts.restaurants,"/restaurants?q="+q],
        ["Drivers",market.counts.drivers,"/drivers"],
        ["Locals",market.counts.locals,"/locals?q="+q],
      ].map(([label,count,href])=><Link key={String(label)} href={String(href)} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-3xl font-semibold">{count}</p><p className="mt-3 text-xs font-semibold text-[#e7c98d]">Explore →</p></Link>)}</div>

      <section className="mt-8 rounded-[2rem] border border-white/10 bg-[#111114] p-6 md:p-8"><p className="text-xs font-black uppercase tracking-[.22em] text-[#c9a86a]">Live supplier searches</p><h2 className="mt-2 font-serif text-4xl font-medium">Complete the trip with live inventory.</h2><div className="mt-6 grid gap-3 md:grid-cols-3"><Link href={"/hotels?q="+q} className="rounded-2xl border border-white/10 p-5"><h3 className="font-semibold">Stays</h3><p className="mt-2 text-sm leading-6 text-white/45">Search current supplier-confirmed hotel availability for your dates.</p><span className="mt-4 inline-block text-sm font-semibold text-[#e7c98d]">Search live hotels →</span></Link><Link href={"/activities?q="+q} className="rounded-2xl border border-white/10 p-5"><h3 className="font-semibold">Activities</h3><p className="mt-2 text-sm leading-6 text-white/45">Check connected activity suppliers rather than relying on cached availability.</p><span className="mt-4 inline-block text-sm font-semibold text-[#e7c98d]">Search live activities →</span></Link><Link href={"/transfers?q="+q} className="rounded-2xl border border-white/10 p-5"><h3 className="font-semibold">Transfers</h3><p className="mt-2 text-sm leading-6 text-white/45">Search current connected transfer routes or request a verified SafariPlug driver.</p><span className="mt-4 inline-block text-sm font-semibold text-[#e7c98d]">Search transfers →</span></Link></div></section>

      {market.events.length>0&&<section className="mt-10"><p className="text-xs font-black uppercase tracking-[.22em] text-[#c9a86a]">Upcoming</p><h2 className="mt-2 font-serif text-4xl font-medium">What is happening in {market.city.name}</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{market.events.map((event:any)=><Link key={event.id} href={"/events/"+event.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs uppercase tracking-wide text-white/35">{event.category||"Event"}</p><h3 className="mt-2 text-xl font-semibold">{event.title}</h3><p className="mt-2 text-sm text-white/45">{event.venue_name||market.city.name}</p><p className="mt-3 text-xs text-[#e7c98d]">{new Date(event.start_at).toLocaleString()}</p></Link>)}</div></section>}

      {market.services.length>0&&<section className="mt-10"><p className="text-xs font-black uppercase tracking-[.22em] text-[#c9a86a]">Active direct partners</p><h2 className="mt-2 font-serif text-4xl font-medium">Useful local services</h2><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{market.services.map((business:any)=><Link key={business.id} href={"/services/"+business.slug} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h3 className="font-semibold">{business.name}</h3><p className="mt-3 text-sm font-semibold text-[#e7c98d]">View live booking →</p></Link>)}</div></section>}

      <section className="mt-12 rounded-[2rem] bg-[#e7c98d] p-8 text-[#070708]"><p className="text-xs font-black uppercase tracking-[.22em]">Amani</p><h2 className="mt-3 font-serif text-4xl font-medium">Build the whole {market.city.name} trip.</h2><p className="mt-3 max-w-2xl leading-7 text-black/60">Ask Amani to combine your dates, budget and interests with SafariPlug&apos;s real direct inventory and governed live-search surfaces.</p><Link href={"/concierge?q="+encodeURIComponent("Plan a trip to "+market.city.name)} className="mt-6 inline-flex rounded-full bg-black px-5 py-3 text-sm font-black text-white">Plan with Amani →</Link></section>
    </section>
  </main>
}
