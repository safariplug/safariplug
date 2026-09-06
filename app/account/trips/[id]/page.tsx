import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TripItemActions from "./TripItemActions";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/admin/login?next=/account/trips`);
  const { id } = await params;

  const { data: trip } = await supabaseAdmin.from("trips").select("id,title,start_on,end_on,status,created_at").eq("id", id).eq("traveler_id", user.id).maybeSingle();
  if (!trip) notFound();

  const { data: items } = await supabaseAdmin
    .from("trip_items")
    .select("id,title,start_at,end_at,notes,item_kind,event_id,city_id,position")
    .eq("trip_id", id)
    .order("position", { ascending: true });

  const cityIds = [...new Set((items ?? []).map((item) => item.city_id).filter(Boolean))];
  const { data: cities } = cityIds.length ? await supabaseAdmin.from("cities").select("id,name,country").in("id", cityIds) : { data: [] };
  const cityMap = new Map((cities ?? []).map((city) => [city.id, city]));

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white md:px-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/account/trips" className="text-sm font-semibold text-zinc-400 hover:text-white">← My Trips</Link>
        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-7 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Journey</p>
              <h1 className="mt-2 text-4xl font-black">{trip.title}</h1>
            </div>
            <span className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300">{trip.status || "draft"}</span>
          </div>
          <p className="mt-4 text-zinc-400">
            {trip.start_on ? new Date(trip.start_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Dates not set"}
            {trip.end_on ? ` – ${new Date(trip.end_on).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
          </p>

          <div className="mt-10 space-y-4">
            {!items?.length ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 p-8 text-center">
                <h2 className="text-xl font-bold">Nothing planned yet</h2>
                <p className="mt-2 text-zinc-400">Go discover an event and add it to this journey.</p>
                <Link href="/events" className="mt-5 inline-flex rounded-full bg-amber-500 px-5 py-3 font-bold text-black">Explore events</Link>
              </div>
            ) : items.map((item, index) => {
              const city = item.city_id ? cityMap.get(item.city_id) : null;
              return (
                <article key={item.id} className="flex gap-4 rounded-2xl border border-zinc-800 bg-black/50 p-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 font-black text-black">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">{item.title || "Experience"}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                      {item.start_at && <span>📅 {new Date(item.start_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                      {city && <span>📍 {city.name}{city.country ? `, ${city.country}` : ""}</span>}
                    </div>
                    {item.notes && <p className="mt-3 text-sm text-zinc-500">{item.notes}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      {item.event_id && <Link href={`/events/${item.event_id}`} className="text-sm font-semibold text-amber-400 hover:text-amber-300">View event →</Link>}
                      <TripItemActions tripId={trip.id} itemId={item.id} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
