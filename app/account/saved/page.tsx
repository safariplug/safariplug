import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TravelerNav from "@/components/TravelerNav";
import SavedExperienceActions from "./SavedExperienceActions";

export default async function SavedPage() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at) redirect("/login?next=/account/saved");

  const { data: saved } = await supabaseAdmin
    .from("saved_events")
    .select("id,event_id,created_at,events(id,title,description,category,venue_name,price,currency,image_url,start_at,cities(name,country))")
    .eq("traveler_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-black text-white">
      <TravelerNav />
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">Your collection</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Saved Experiences.</h1>
            <p className="mt-4 max-w-2xl text-zinc-400">Keep the experiences that catch your eye and come back when you are ready to build your journey.</p>
          </div>
          <Link href="/events" className="rounded-full bg-[#e7c98d] px-5 py-3 text-sm font-black text-black">Discover more →</Link>
        </div>

        {saved?.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((item: any) => {
              const event = item.events;
              if (!event) return null;
              return (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 transition hover:-translate-y-1 hover:border-[#c9a86a]/50">
                  <Link href={`/events/${event.id}`} className="group block">
                    <div className="h-48 bg-zinc-900">
                      {event.image_url ? <img src={event.image_url} alt={event.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-xs font-bold uppercase tracking-widest text-[#c9a86a]">{event.category || "SafariPlug"}</div>}
                    </div>
                    <div className="p-5 pb-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#c9a86a]">{event.category || "Experience"}</p>
                      <h2 className="mt-2 text-xl font-bold">{event.title}</h2>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{event.description || "Discover this SafariPlug experience."}</p>
                      <p className="mt-4 text-xs text-zinc-400">📍 {event.venue_name || event.cities?.name || "East Africa"}</p>
                      <p className="mt-1 text-xs text-zinc-400">📅 {new Date(event.start_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </Link>
                  <div className="px-5 pb-5">
                    <SavedExperienceActions eventId={event.id} savedId={item.id} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-zinc-800 p-12 text-center">
            <h2 className="text-2xl font-bold">Nothing saved yet.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-500">When you find something you love, save it here and decide later.</p>
            <Link href="/events" className="mt-6 inline-flex rounded-full border border-[#c9a86a]/50 px-5 py-3 text-sm font-bold text-[#e7c98d]">Start discovering →</Link>
          </div>
        )}
      </div>
    </main>
  );
}
