import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MarketplaceViewTracker from "@/components/MarketplaceViewTracker";

export const dynamic="force-dynamic";

export default async function DestinationsPage(){
  const {data:cities}=await supabaseAdmin.from("cities").select("id,name,country,slug").not("slug","is",null).order("name").limit(100);
  return <main className="min-h-screen bg-[#070708] text-white"><MarketplaceViewTracker surface="destinations" /><section className="mx-auto max-w-7xl px-5 py-16 md:px-8 lg:px-10"><Link href="/" className="text-sm font-semibold text-[#e7c98d]">← SafariPlug</Link><p className="mt-10 text-xs font-black uppercase tracking-[.28em] text-[#c9a86a]">Explore Africa</p><h1 className="mt-4 max-w-4xl font-serif text-6xl font-medium tracking-tight md:text-8xl">Start with a destination.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">See where SafariPlug has active direct local supply, then move into governed live searches for stays, activities and transfers.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(cities||[]).map(city=><Link key={city.id} href={"/destinations/"+city.slug} className="rounded-[1.75rem] border border-white/10 bg-white/[.04] p-6 transition hover:border-[#c9a86a]/40"><p className="text-xs uppercase tracking-wide text-white/35">{city.country}</p><h2 className="mt-2 font-serif text-3xl font-medium">{city.name}</h2><p className="mt-5 text-sm font-semibold text-[#e7c98d]">Open destination →</p></Link>)}</div></section></main>
}
