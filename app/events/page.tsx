import { createClient } from "@supabase/supabase-js";
import EventCard from "@/components/EventCard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function EventsPage() {
  const today = new Date().toISOString();

  const { data: events, error } = await supabase
    .from("ai_discovered_events")
    .select("id, title, description, category, venue_name, price, currency, image_url, start_at, is_featured, status")
    .eq("status", "approved")
    .gte("start_at", today)
    .order("is_featured", { ascending: false })
    .order("start_at", { ascending: true });

  if (error) {
    console.error("Supabase fetch error:", error.message);
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white md:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Discovered Experiences
          </h1>
          <p className="mt-2 text-gray-400">
            Curated urban and coastal adventures across East Africa.
          </p>
        </header>

        {!events || events.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-20 text-center">
            <p className="text-gray-400">
              No upcoming approved experiences found at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
