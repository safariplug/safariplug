import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

export const dynamic = "force-dynamic";

const popular = [
  ["Massage", "spas-massage", "Relax, recover or book a mobile hotel massage."],
  ["Barbers", "barbers", "Haircuts, beard care and mobile barber appointments."],
  ["Hair & Beauty", "hair-beauty", "Styling, braiding, makeup and beauty appointments."],
  ["Nails", "nails", "Manicure, pedicure and nail appointments."],
  ["Tattoo", "tattoo-body-art", "Independent artists, consultations and tattoo sessions."],
  ["Kitesurfing", "water-sports-kite", "Instructor-led kite and water-sports sessions."],
  ["Diving", "diving-marine", "Scuba, snorkeling and freediving professionals."],
  ["Fitness", "fitness-personal-training", "Personal training at gyms, hotels and villas."],
] as const;

function money(value: unknown, currency: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `${String(currency || "KES")} ${amount.toLocaleString()}`;
}

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; tripId?: string }> }) {
  const { category, q, tripId: rawTripId } = await searchParams;
  const tripId = rawTripId?.trim() || null;
  const withTrip = (href: string) => tripId ? `${href}${href.includes("?") ? "&" : "?"}tripId=${encodeURIComponent(tripId)}` : href;
  const term = q?.trim().toLowerCase() ?? "";
  const { data: categories } = await supabaseAdmin.from("service_categories").select("id,name,slug,description").eq("status", "active").order("name");
  let query = supabaseAdmin.from("service_profiles").select("id,businesses!inner(name,slug,description,city_id,logo_url,cover_image_url),service_categories!inner(name,slug),service_offerings(id,name,duration_minutes,price,currency)").eq("status", "active").eq("booking_status", "open").eq("businesses.status", "active").eq("service_categories.status", "active").eq("service_offerings.status", "active");
  if (category) query = query.eq("service_categories.slug", category);
  const { data: rawServices } = await query;
  const services = (rawServices ?? []).filter((s: any) => !term || [s.businesses?.name, s.businesses?.description, s.service_categories?.name, ...(s.service_offerings ?? []).map((x:any)=>x.name)].filter(Boolean).join(" ").toLowerCase().includes(term));
  const activeCategory = (categories ?? []).find((c: any) => c.slug === category);

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="relative overflow-hidden bg-[#111] text-white"><div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16"><div className="max-w-4xl"><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug / Local Services</p><h1 className="mt-5 text-5xl font-semibold tracking-[-.045em] sm:text-7xl">Book the person you need.<br/><span className="text-white/45">Without hunting around town.</span></h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Massage, barbers, nails, tattoo artists, trainers, water-sports instructors and more. SafariPlug only shows providers whose profiles and booking status are live.</p><form action="/services" className="mt-8 flex max-w-2xl gap-2 rounded-2xl bg-white p-2">{tripId&&<input type="hidden" name="tripId" value={tripId}/>}<input name="q" defaultValue={q} placeholder="Try ‘massage’, ‘barber’ or ‘diving’" className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-black outline-none"/><button className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">Find a service</button></form></div></div></section>
    <DiscoverySwitcher current="/services" />
    {tripId&&<section className="mx-auto max-w-7xl px-6 pt-6 sm:px-10"><div className="rounded-2xl border border-black/8 bg-white px-5 py-4 text-sm text-black/55">Choose a service for your selected SafariPlug trip. The trip stays attached through provider selection and booking.</div></section>}
    <section className="mx-auto max-w-7xl px-6 py-10 sm:px-10"><div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/35">Popular right now</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Get there in one tap.</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{popular.map(([name,slug,description]) => <Link key={slug} href={withTrip(`/services?category=${slug}`)} className="rounded-[1.4rem] border border-black/8 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9a86a]/60"><p className="font-semibold">{name} <span className="float-right text-[#9d793e]">→</span></p><p className="mt-2 text-xs leading-5 text-black/50">{description}</p></Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-6 pb-8 sm:px-10"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[.2em] text-black/35">All categories</p><div className="flex flex-wrap gap-2"><Link href={withTrip("/services")} className={`rounded-full border px-4 py-2.5 text-xs font-semibold ${!category && !term ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60"}`}>All services</Link>{(categories ?? []).map((c:any)=><Link key={c.id} href={withTrip(`/services?category=${encodeURIComponent(c.slug)}`)} className={`rounded-full border px-4 py-2.5 text-xs font-semibold ${category===c.slug ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-black/25"}`}>{c.name}</Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-10"><div className="flex items-end justify-between gap-6"><div><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-black/40">{term ? `Search: ${q}` : activeCategory?.name ?? "Bookable providers"}</p><h2 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">{term ? "Matching live providers and services" : activeCategory?.description ?? "Choose a provider, compare their services, then check real appointment times."}</h2></div><span className="hidden rounded-full bg-white px-4 py-2 text-xs text-black/45 shadow-sm sm:inline-flex">{services.length} providers</span></div><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map((s:any)=>{const offers=s.service_offerings??[]; const prices=offers.map((x:any)=>Number(x.price)).filter(Number.isFinite); const from=prices.length?Math.min(...prices):null; const currency=offers.find((x:any)=>Number.isFinite(Number(x.price)))?.currency; const image=s.businesses?.cover_image_url||s.businesses?.logo_url; return <Link key={s.id} href={withTrip(`/services/${s.businesses.slug}`)} className="group overflow-hidden rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(0,0,0,.5)] transition hover:-translate-y-1"><div className="relative flex aspect-[16/9] items-end overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#e8e5dc] via-[#d8d3c8] to-[#b9b3a6] p-4">{image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover"/>}<span className="relative rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] backdrop-blur">{s.service_categories?.name??"Service"}</span></div><div className="px-1 pb-1 pt-5"><div className="flex items-start justify-between gap-4"><h3 className="text-xl font-semibold tracking-tight">{s.businesses.name}</h3><span className="text-lg transition group-hover:translate-x-1">↗</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-black/55">{s.businesses.description??"SafariPlug service provider."}</p><div className="mt-4 flex flex-wrap gap-2">{offers.slice(0,3).map((x:any)=><span key={x.id} className="rounded-full bg-black/[.04] px-3 py-1.5 text-[11px] text-black/55">{x.name}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-black/8 pt-4 text-xs text-black/45"><span>{offers.length} services{from!==null?` · from ${money(from,currency)}`:""}</span><span className="font-semibold text-black/65">Check times →</span></div></div></Link>})}</div>{!services.length&&<div className="mt-8 rounded-[2rem] border border-dashed border-black/15 bg-white px-6 py-20 text-center"><p className="text-lg font-semibold">No live provider matches that yet.</p><p className="mt-2 text-sm text-black/50">We won’t invent availability. Try another category or ask Concierge for help.</p><Link href={`/concierge${q?`?q=${encodeURIComponent(q)}`:""}`} className="mt-5 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Ask Concierge →</Link></div>}</section>
  </main>;
}
