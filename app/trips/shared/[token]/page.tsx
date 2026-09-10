import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: trip } = await supabaseAdmin.from("trips").select("id,title,start_on,end_on,status,destination_city_id").eq("share_token", token).maybeSingle();
  if (!trip) notFound();

  const { data: items } = await supabaseAdmin.from("trip_items").select("id,title,start_at,end_at,notes,item_kind,city_id,event_id,position").eq("trip_id", trip.id).order("position", { ascending: true });
  const cityIds = [...new Set([trip.destination_city_id, ...(items ?? []).map((item) => item.city_id)].filter(Boolean))];
  const { data: cities } = cityIds.length ? await supabaseAdmin.from("cities").select("id,name,country").in("id", cityIds) : { data: [] };
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city]));
  const destination = trip.destination_city_id ? cityMap.get(trip.destination_city_id) : null;

  return <main className="min-h-screen bg-black px-5 py-10 text-white print:bg-white print:text-black"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 print:text-black">SafariPlug Journey</p><h1 className="mt-2 text-4xl font-black">{trip.title}</h1>{destination && <p className="mt-2 text-sm text-zinc-400 print:text-zinc-600">📍 {destination.name}{destination.country ? `, ${destination.country}` : ""}</p>}</div><Link href="/events" className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-bold print:hidden">Discover more</Link></div><p className="mt-4 text-sm text-zinc-400 print:text-zinc-600">{trip.start_on ? new Date(trip.start_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Dates not set"}{trip.end_on ? ` – ${new Date(trip.end_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}</p><div className="mt-10 space-y-4">{items?.length ? items.map((item, index) => { const city = item.city_id ? cityMap.get(item.city_id) : null; return <article key={item.id} className="rounded-2xl border border-zinc-800 p-5 print:border-zinc-300"><div className="flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-black">{index + 1}</div><div><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{item.item_kind === "personal_service" ? "Booked service" : "Experience"}</span><h2 className="mt-1 text-xl font-bold">{item.title || "Experience"}</h2><div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-400 print:text-zinc-600">{item.start_at && <span>📅 {new Date(item.start_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}{city && <span>📍 {city.name}</span>}</div>{item.notes && <p className="mt-3 text-sm text-zinc-500">{item.notes}</p>}{item.event_id && <Link href={`/events/${item.event_id}`} className="mt-3 inline-block text-sm font-semibold text-amber-400 print:hidden">View experience →</Link>}</div></div></article>; }) : <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">This journey has no planned experiences yet.</div>}</div><footer className="mt-10 border-t border-zinc-800 pt-5 text-xs text-zinc-500 print:border-zinc-300">Shared from SafariPlug · safariplug.com</footer></div></main>;
}
