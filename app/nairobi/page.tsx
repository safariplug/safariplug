import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const metadata = {
  title: "Nairobi Events & Experiences | SafariPlug",
  description:
    "Discover Nairobi events, nightlife, food experiences, adventures, and things to do today and this weekend.",
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  venue_name: string | null;
  image_url: string | null;
};

export default async function NairobiPage() {
  const now = new Date().toISOString();
  const effectiveValidityFilter = `end_at.gte.${now},and(end_at.is.null,start_at.gte.${now})`;

  const { data } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      description,
      category,
      start_at,
      venue_name,
      image_url,
      cities!inner(name)
      `
    )
    .eq("cities.name", "Nairobi")
    .eq("status", "approved")
    .or(effectiveValidityFilter)
    .order("start_at", {
      ascending: true,
    })
    .limit(12);

  const events = (data || []) as Event[];

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-950">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link href="/" className="text-3xl font-black">
            Safari<span className="text-orange-500">Plug</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="font-black uppercase tracking-widest text-orange-500">
          Nairobi Experiences
        </p>

        <h1 className="mt-5 text-5xl font-black md:text-7xl">
          Things To Do In Nairobi
        </h1>

        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">
          Discover the best Nairobi events, experiences, nightlife,
          restaurants, adventures and activities happening around the city.
        </p>

        <h2 className="mt-16 text-3xl font-black">
          Upcoming Nairobi Events
        </h2>

        {events.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">
            <p className="text-slate-500">
              New Nairobi experiences are being added soon.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-xl"
              >
                {event.image_url && (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-56 w-full object-cover"
                  />
                )}

                <div className="p-6">
                  <span className="text-sm font-black text-orange-500">
                    {event.category}
                  </span>

                  <h3 className="mt-3 text-2xl font-black">
                    {event.title}
                  </h3>

                  {event.venue_name && (
                    <p className="mt-3 text-sm text-slate-500">
                      📍 {event.venue_name}
                    </p>
                  )}

                  {event.description && (
                    <p className="mt-4 line-clamp-3 text-sm text-slate-600">
                      {event.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}