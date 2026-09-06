import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function TripsPage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/admin/login?next=/account/trips`);

  const { data: trips } = await supabaseAdmin
    .from("trips")
    .select("id,title,start_on,end_on,status,created_at")
    .eq("traveler_id", user.id)
    .order("start_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const ids = (trips ?? []).map((trip) => trip.id);
  const { data: items } = ids.length
    ? await supabaseAdmin.from("trip_items").select("trip_id,title,start_at,event_id").in("trip_id", ids).order("position")
    : { data: [] };
  const itemCounts = new Map<string, number>();
  for (const item of items ?? []) itemCounts.set(item.trip_id, (itemCounts.get(item.trip_id) ?? 0) + 1);

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Your journeys</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">My Trips</h1>
            <p className="mt-3 max-w-2xl text-zinc-400">Keep your discoveries together and turn them into a journey.</p>
          </div>
          <Link href="/events" className="rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-400">Discover experiences</Link>
        </div>

        {!trips?.length ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
            <div className="text-5xl">🧭</div>
            <h2 className="mt-4 text-2xl font-bold">Your first journey starts here</h2>
            <p className="mx-auto mt-2 max-w-md text-zinc-400">Explore SafariPlug, find something worth doing and add it to a trip.</p>
            <Link href="/events" className="mt-6 inline-flex rounded-full bg-white px-6 py-3 font-bold text-black">Explore events</Link>
          </section>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <Link key={trip.id} href={`/account/trips/${trip.id}`} className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-amber-500/60 hover:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">{trip.status || "draft"}</span>
                  <span className="text-xs text-zinc-500">{itemCounts.get(trip.id) ?? 0} plans</span>
                </div>
                <h2 className="mt-6 text-2xl font-bold group-hover:text-amber-300">{trip.title}</h2>
                <p className="mt-3 text-sm text-zinc-400">
                  {trip.start_on ? new Date(trip.start_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Dates not set"}
                  {trip.end_on ? ` – ${new Date(trip.end_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </p>
                <div className="mt-6 text-sm font-semibold text-amber-400">Open journey →</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
