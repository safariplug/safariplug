import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

export const dynamic = "force-dynamic";

type Restaurant = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  city_id: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  restaurant_settings: {
    ordering_enabled: boolean;
    pickup_enabled: boolean;
    restaurant_delivery_enabled: boolean;
    safari_driver_enabled: boolean;
    customer_driver_enabled: boolean;
    minimum_order_amount: number | null;
  } | null;
};

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = q?.trim().toLowerCase() ?? "";

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id,name,slug,description,city_id,logo_url,cover_image_url,restaurant_settings!inner(ordering_enabled,pickup_enabled,restaurant_delivery_enabled,safari_driver_enabled,customer_driver_enabled,minimum_order_amount)")
    .eq("business_type", "Restaurant")
    .eq("status", "active")
    .eq("restaurant_settings.ordering_enabled", true)
    .order("name");

  const restaurants = ((data ?? []) as unknown as Restaurant[]).filter((restaurant) => {
    if (!term) return true;
    return [restaurant.name, restaurant.description].filter(Boolean).join(" ").toLowerCase().includes(term);
  });

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="bg-[#111] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-10 sm:pb-20 sm:pt-16">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#c9a86a]">SafariPlug / Restaurants & Food</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-.045em] sm:text-7xl">Find food. Order simply.<br/><span className="text-white/45">Keep it inside your trip.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Browse restaurants that are actually active on SafariPlug and currently have online ordering enabled. Menus, prices and fulfilment options come from the restaurant&apos;s live setup.</p>
          <form action="/restaurants" className="mt-8 flex max-w-2xl gap-2 rounded-2xl bg-white p-2">
            <input name="q" defaultValue={q} placeholder="Search restaurants or food" className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-black outline-none"/>
            <button className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">Find food</button>
          </form>
        </div>
      </div>
    </section>

    <DiscoverySwitcher current="/restaurants" />

    <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/35">{term ? `Search: ${q}` : "Live dining"}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Restaurants accepting SafariPlug orders</h2></div>
        <span className="rounded-full bg-white px-4 py-2 text-xs text-black/45 shadow-sm">{restaurants.length} restaurant{restaurants.length === 1 ? "" : "s"}</span>
      </div>

      {error ? <div className="mt-8 rounded-[1.5rem] border border-red-200 bg-white p-6"><h3 className="font-semibold">Restaurant discovery is temporarily unavailable.</h3><p className="mt-2 text-sm text-black/50">We won&apos;t substitute invented restaurant inventory. Please try again or ask Concierge.</p><Link href={`/concierge${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="mt-4 inline-flex rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Ask Concierge →</Link></div> : null}

      {!error && restaurants.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{restaurants.map((restaurant) => {
        const settings = restaurant.restaurant_settings;
        const image = restaurant.cover_image_url || restaurant.logo_url;
        const methods = [settings?.pickup_enabled && "Pickup", settings?.restaurant_delivery_enabled && "Restaurant delivery", settings?.safari_driver_enabled && "SafariPlug driver", settings?.customer_driver_enabled && "Your driver"].filter(Boolean) as string[];
        return <Link key={restaurant.id} href={`/restaurants/${restaurant.id}`} className="group overflow-hidden rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_18px_60px_-45px_rgba(0,0,0,.5)] transition hover:-translate-y-1">
          <div className="relative flex aspect-[16/9] items-end overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#e8e5dc] via-[#d8d3c8] to-[#b9b3a6] p-4">{image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover"/>}<span className="relative rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] backdrop-blur">Ordering live</span></div>
          <div className="px-1 pb-1 pt-5"><div className="flex items-start justify-between gap-4"><h3 className="text-xl font-semibold tracking-tight">{restaurant.name}</h3><span className="text-lg transition group-hover:translate-x-1">↗</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-black/55">{restaurant.description || "Browse the live SafariPlug menu and available fulfilment options."}</p><div className="mt-4 flex flex-wrap gap-2">{methods.map((method) => <span key={method} className="rounded-full bg-black/[.04] px-3 py-1.5 text-[11px] text-black/55">{method}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-black/8 pt-4 text-xs text-black/45"><span>{settings?.minimum_order_amount ? `Minimum order ${Number(settings.minimum_order_amount).toLocaleString()}` : "Live menu"}</span><span className="font-semibold text-black/65">View menu →</span></div></div>
        </Link>;
      })}</div> : null}

      {!error && !restaurants.length ? <div className="mt-8 rounded-[2rem] border border-dashed border-black/15 bg-white px-6 py-20 text-center"><p className="text-lg font-semibold">No live restaurant matches that yet.</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-black/50">SafariPlug only lists restaurants that are active and have real online ordering enabled. We won&apos;t invent menus or availability.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/restaurants" className="rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold">Clear search</Link><Link href={`/concierge${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Ask Concierge →</Link></div></div> : null}
    </section>
  </main>;
}
