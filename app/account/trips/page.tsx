import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TravelerNav from "@/components/TravelerNav";
import NewTripButton from "./NewTripButton";

export default async function TripsPage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous) redirect(`/login?next=/account/trips`);

  const [{ data: trips }, { data: cities }, { data: localRequests }] = await Promise.all([
    supabaseAdmin.from("trips").select("id,title,start_on,end_on,status,created_at").eq("traveler_id", user.id).order("start_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    supabaseAdmin.from("cities").select("id,name,country").order("name"),
    supabaseAdmin.from("local_requests").select("id,trip_id,activity,city,requested_start,requested_end,status,created_at").eq("traveler_id", user.id).order("created_at", { ascending: false }),
  ]);
  const ids = (trips ?? []).map((trip) => trip.id);
  const { data: items } = ids.length ? await supabaseAdmin.from("trip_items").select("trip_id,title,start_at,event_id").in("trip_id", ids).order("position") : { data: [] };
  const itemCounts = new Map<string, number>();
  for (const item of items ?? []) itemCounts.set(item.trip_id, (itemCounts.get(item.trip_id) ?? 0) + 1);
  const requestCounts = new Map<string, number>();
  for (const request of localRequests ?? []) if (request.trip_id) requestCounts.set(request.trip_id, (requestCounts.get(request.trip_id) ?? 0) + 1);

  return <main className="min-h-screen bg-black text-white"><TravelerNav/><div className="mx-auto max-w-6xl px-6 py-12 md:px-12"><div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Your journeys</p><h1 className="mt-2 text-4xl font-black md:text-5xl">My Trips</h1><p className="mt-3 max-w-2xl text-zinc-400">Keep your discoveries, bookings and Local requests together in one journey.</p></div><div className="flex flex-wrap gap-3"><NewTripButton cities={cities ?? []}/><Link href="/events" className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-bold text-white transition hover:border-amber-500/60 hover:text-amber-300">Discover experiences</Link></div></div>

      {!!localRequests?.length && <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-400">Local requests</p><h2 className="mt-2 text-2xl font-bold">Your Local connections</h2><p className="mt-2 text-sm text-zinc-400">A request is not a paid or confirmed booking until the Local accepts it and any required booking steps are completed.</p></div><Link href="/locals" className="text-sm font-bold text-amber-400">Find a Local →</Link></div><div className="mt-5 grid gap-3 md:grid-cols-2">{localRequests.map((request)=><div key={request.id} className="rounded-xl border border-zinc-800 bg-black p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{request.activity || "Local request"}</span><Status status={request.status}/></div><p className="mt-2 text-xs text-zinc-500">{request.city || "Location not specified"}{request.requested_start ? ` · ${formatDate(request.requested_start)}` : ""}</p>{request.trip_id && <Link href={`/account/trips/${request.trip_id}`} className="mt-3 inline-flex text-xs font-bold text-amber-400">View in trip →</Link>}</div>)}</div></section>}

      {!trips?.length?<section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center"><div className="text-5xl">🧭</div><h2 className="mt-4 text-2xl font-bold">Your first journey starts here</h2><p className="mx-auto mt-2 max-w-md text-zinc-400">Start with a trip, then add the SafariPlug experiences and people you want along the way.</p><div className="flex flex-wrap justify-center gap-3"><NewTripButton empty cities={cities ?? []}/><Link href="/events" className="mt-6 inline-flex rounded-full border border-zinc-700 px-6 py-3 font-bold text-white">Explore events</Link></div></section>:<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{trips.map((trip)=><Link key={trip.id} href={`/account/trips/${trip.id}`} className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-amber-500/60 hover:bg-zinc-900"><div className="flex items-center justify-between"><span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">{trip.status||"draft"}</span><span className="text-xs text-zinc-500">{itemCounts.get(trip.id)??0} plans{requestCounts.get(trip.id) ? ` · ${requestCounts.get(trip.id)} Local` : ""}</span></div><h2 className="mt-6 text-2xl font-bold group-hover:text-amber-300">{trip.title}</h2><p className="mt-3 text-sm text-zinc-400">{trip.start_on?new Date(trip.start_on).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"Dates not set"}{trip.end_on?` – ${new Date(trip.end_on).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:""}</p><div className="mt-6 text-sm font-semibold text-amber-400">Open journey →</div></Link>)}</div>}</div></main>;
}

function Status({ status }: { status: string | null }) {
  const value = status || "requested";
  const label = value === "requested" ? "Pending" : value.charAt(0).toUpperCase() + value.slice(1);
  return <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-300">{label}</span>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
