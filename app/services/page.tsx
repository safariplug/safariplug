import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const { data: categories } = await supabaseAdmin.from("service_categories").select("id,name,slug,description").eq("status", "active").order("name");

  let query = supabaseAdmin.from("service_profiles").select("id,businesses!inner(name,slug,description,city_id),service_categories!inner(name,slug),service_offerings(id,name,duration_minutes,price,currency)").eq("status", "active").eq("booking_status", "open").eq("service_offerings.status", "active");
  if (category) query = query.eq("service_categories.slug", category);
  const { data: services } = await query;
  const activeCategory = (categories ?? []).find((c: any) => c.slug === category);

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="relative overflow-hidden bg-[#111] text-white"><div className="mx-auto max-w-7xl px-6 pb-20 pt-14 sm:px-10 sm:pt-20"><div className="max-w-3xl"><p className="text-[11px] font-semibold uppercase tracking-[.28em] text-white/45">SafariPlug / Services</p><h1 className="mt-5 text-5xl font-semibold tracking-[-.045em] sm:text-7xl">Book your next<br/><span className="text-white/45">perfect appointment.</span></h1><p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Discover exceptional local specialists with real services, real staff and real appointment availability — from a single SafariPlug account.</p></div></div></section>
    <section className="mx-auto max-w-7xl px-6 py-10 sm:px-10"><div className="flex flex-wrap gap-2"><Link href="/services" className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${!category ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-black/25"}`}>All services</Link>{(categories ?? []).map((c: any) => <Link key={c.id} href={`/services?category=${encodeURIComponent(c.slug)}`} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${category === c.slug ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/60 hover:border-black/25"}`}>{c.name}</Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-10"><div className="flex items-end justify-between gap-6"><div><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-black/40">{activeCategory?.name ?? "Curated services"}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{activeCategory?.description ?? "Find somewhere worth your time."}</h2></div><span className="hidden rounded-full bg-white px-4 py-2 text-xs text-black/45 shadow-sm sm:inline-flex">{(services ?? []).length} providers</span></div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{(services ?? []).map((s: any) => <Link key={s.id} href={`/services/${s.businesses.slug}`} className="group overflow-hidden rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(0,0,0,.5)] transition hover:-translate-y-1 hover:shadow-[0_25px_70px_-40px_rgba(0,0,0,.55)]"><div className="flex aspect-[16/9] items-end rounded-[1.25rem] bg-gradient-to-br from-[#e8e5dc] via-[#d8d3c8] to-[#b9b3a6] p-4"><span className="rounded-full bg-white/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] backdrop-blur">{s.service_categories?.name ?? "Service"}</span></div><div className="px-1 pb-1 pt-5"><div className="flex items-start justify-between gap-4"><h3 className="text-xl font-semibold tracking-tight">{s.businesses.name}</h3><span className="mt-1 text-lg transition group-hover:translate-x-1">↗</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-black/55">{s.businesses.description ?? "A carefully selected SafariPlug service provider."}</p><div className="mt-5 flex items-center justify-between border-t border-black/8 pt-4 text-xs text-black/45"><span>{(s.service_offerings ?? []).length} services</span><span>View & book</span></div></div></Link>)}</div>
      {!(services ?? []).length && <div className="rounded-[2rem] border border-dashed border-black/15 bg-white px-6 py-20 text-center"><p className="text-lg font-semibold">No providers are live in this category yet.</p><p className="mt-2 text-sm text-black/50">SafariPlug will show providers here once they have approved services and open booking calendars.</p></div>}
    </section>
  </main>;
}
