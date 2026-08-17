import { supabase } from "@/lib/supabase";

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  featured: boolean;
};

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(dateString));
}

function formatTime(dateString: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateString));
}

function formatPrice(price: number | null, currency: string | null) {
  if (price === null) return "Free";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency || "KES",
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function EventsPage() {
  const { data: events, error } = await supabase
    .from("events")
    .select(
      `
        id,
        title,
        description,
        category,
        start_at,
        end_at,
        venue_name,
        venue_address,
        price,
        currency,
        image_url,
        featured
      `
    )
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("start_at", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <a href="/" className="text-2xl font-black tracking-tight">
            Safari<span className="text-orange-500">Plug</span>
          </a>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="hidden text-sm font-semibold text-slate-600 hover:text-orange-500 sm:block"
            >
              Home
            </a>

            <a
              href="/submit"
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
            >
              List Your Event
            </a>
          </div>

        </div>
      </header>

      {/* HERO */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">

          <p className="font-bold uppercase tracking-widest text-orange-400">
            SafariPlug Events
          </p>

          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Find something happening.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Discover concerts, nightlife, festivals, comedy, food events,
            cultural experiences and more across East Africa.
          </p>

          {/* FILTERS */}
          <div className="mt-10 grid gap-3 md:grid-cols-3">

            <div className="rounded-xl bg-white px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                City
              </div>
              <div className="mt-1 font-semibold">
                Nairobi
              </div>
            </div>

            <div className="rounded-xl bg-white px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Category
              </div>
              <div className="mt-1 font-semibold">
                All Events
              </div>
            </div>

            <div className="rounded-xl bg-white px-5 py-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                When
              </div>
              <div className="mt-1 font-semibold">
                Upcoming
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* EVENTS */}
      <section className="mx-auto max-w-7xl px-6 py-16">

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-bold uppercase tracking-widest text-orange-500">
              Upcoming
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight">
              Events worth checking out
            </h2>
          </div>

          <div className="hidden text-sm text-slate-500 sm:block">
            {events?.length || 0} event{events?.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* DATABASE ERROR */}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <div className="font-bold">
              Unable to load events
            </div>

            <div className="mt-2 text-sm">
              {error.message}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!error && (!events || events.length === 0) && (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">

            <div className="text-5xl">🎉</div>

            <h3 className="mt-5 text-2xl font-black">
              Nothing listed yet
            </h3>

            <p className="mx-auto mt-3 max-w-md text-slate-500">
              We're discovering what's happening around the city.
              Check back soon or submit your own event.
            </p>

            <a
              href="/submit"
              className="mt-7 inline-block rounded-full bg-orange-500 px-7 py-3 font-bold text-white hover:bg-orange-600"
            >
              Submit an Event
            </a>

          </div>
        )}

        {/* EVENT GRID */}
        {!error && events && events.length > 0 && (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

            {events.map((event: Event) => (
              <article
                key={event.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >

                {/* IMAGE */}
                <div className="relative flex h-56 items-center justify-center overflow-hidden bg-slate-200">

                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-6xl">
                      {event.category === "Nightlife"
                        ? "🎵"
                        : event.category === "Food"
                          ? "🍽️"
                          : event.category === "Adventure"
                            ? "🧗"
                            : "🎉"}
                    </div>
                  )}

                  {event.featured && (
                    <div className="absolute left-4 top-4 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
                      Featured
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow">
                    {event.category}
                  </div>

                </div>

                {/* CONTENT */}
                <div className="p-6">

                  <h3 className="text-xl font-black leading-tight">
                    {event.title}
                  </h3>

                  {event.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                      {event.description}
                    </p>
                  )}

                  <div className="mt-5 space-y-3 text-sm">

                    <div className="flex gap-3">
                      <span>📅</span>

                      <div>
                        <div className="font-semibold">
                          {formatDate(event.start_at)}
                        </div>

                        <div className="text-slate-500">
                          {formatTime(event.start_at)}
                        </div>
                      </div>
                    </div>

                    {event.venue_name && (
                      <div className="flex gap-3">
                        <span>📍</span>

                        <div>
                          <div className="font-semibold">
                            {event.venue_name}
                          </div>

                          {event.venue_address && (
                            <div className="text-slate-500">
                              {event.venue_address}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <span>💰</span>

                      <div className="font-bold">
                        {formatPrice(event.price, event.currency)}
                      </div>
                    </div>

                  </div>

                  <button className="mt-6 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600">
                    View Event
                  </button>

                </div>

              </article>
            ))}

          </div>
        )}

      </section>

      {/* BUSINESS CTA */}
      <section className="bg-orange-500">
        <div className="mx-auto max-w-7xl px-6 py-16">

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">

            <div>
              <p className="font-bold uppercase tracking-widest text-orange-100">
                Event organizers
              </p>

              <h2 className="mt-2 text-3xl font-black text-white">
                Have an event coming up?
              </h2>

              <p className="mt-3 max-w-xl text-orange-50">
                List it on SafariPlug and get discovered by people looking
                for something to do.
              </p>
            </div>

            <a
              href="/submit"
              className="rounded-full bg-white px-7 py-3.5 text-center font-bold text-orange-600 hover:bg-orange-50"
            >
              Submit Your Event
            </a>

          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-10 md:flex-row">

          <div>
            <a href="/" className="text-xl font-black">
              Safari<span className="text-orange-500">Plug</span>
            </a>

            <p className="mt-2 text-sm text-slate-500">
              Discover more. Experience more.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            © 2026 SafariPlug
          </div>

        </div>
      </footer>

    </main>
  );
}