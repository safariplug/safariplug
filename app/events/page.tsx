import Link from "next/link";
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
  if (price === null) {
    return "Free";
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency || "KES",
    maximumFractionDigits: 0,
  }).format(price);
}

function categoryIcon(category: string) {
  const value = category.toLowerCase();

  if (
    value.includes("nightlife") ||
    value.includes("music") ||
    value.includes("concert")
  ) {
    return "🎵";
  }

  if (value.includes("food")) {
    return "🍽️";
  }

  if (
    value.includes("adventure") ||
    value.includes("sport")
  ) {
    return "🧗";
  }

  if (value.includes("comedy")) {
    return "😂";
  }

  if (value.includes("culture")) {
    return "🎭";
  }

  return "🎉";
}

function EventImage({
  event,
  large = false,
}: {
  event: Event;
  large?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-slate-900 ${
        large ? "h-72 md:h-96" : "h-56"
      }`}
    >
      {event.image_url ? (
        <img
          src={event.image_url}
          alt={event.title}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className={large ? "text-8xl" : "text-7xl"}>
          {categoryIcon(event.category)}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {event.featured && (
        <div className="absolute left-5 top-5 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg">
          ⭐ Featured
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">

      <EventImage event={event} />

      <div className="p-6">

        <div className="flex items-center justify-between gap-3">

          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-600">
            {event.category}
          </span>

          <span className="text-xs font-semibold text-slate-400">
            Nairobi
          </span>

        </div>

        <h3 className="mt-4 text-xl font-black leading-tight">
          {event.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
          {event.description || "Discover this event on SafariPlug."}
        </p>

        <div className="mt-5 flex gap-3">

          <div className="text-lg">
            📅
          </div>

          <div>
            <div className="text-sm font-bold">
              {formatDate(event.start_at)}
            </div>

            <div className="text-xs text-slate-500">
              {formatTime(event.start_at)}
            </div>
          </div>

        </div>

        <div className="mt-4 flex gap-3">

          <div className="text-lg">
            📍
          </div>

          <div>
            <div className="text-sm font-bold">
              {event.venue_name || "Venue to be announced"}
            </div>

            <div className="text-xs text-slate-500">
              {event.venue_address || "Nairobi, Kenya"}
            </div>
          </div>

        </div>

        <div className="mt-4 flex gap-3">

          <div className="text-lg">
            💰
          </div>

          <div className="text-sm font-bold">
            {formatPrice(event.price, event.currency)}
          </div>

        </div>

        <Link
          href={`/events/${event.id}`}
          className="mt-7 flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-orange-600"
        >
          View Event
        </Link>

      </div>

    </article>
  );
}

function FeaturedEventCard({ event }: { event: Event }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl">

      <div className="grid md:grid-cols-2">

        <EventImage event={event} large />

        <div className="flex flex-col justify-center p-7 md:p-10">

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-orange-700">
              {event.category}
            </span>

            <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-black text-yellow-700">
              ⭐ Featured Event
            </span>

          </div>

          <h3 className="mt-5 text-3xl font-black leading-tight md:text-4xl">
            {event.title}
          </h3>

          <p className="mt-4 line-clamp-3 leading-7 text-slate-500">
            {event.description ||
              "Discover this featured event on SafariPlug."}
          </p>

          <div className="mt-6 space-y-4">

            <div className="flex gap-3">

              <div className="text-xl">
                📅
              </div>

              <div>
                <div className="text-sm font-black">
                  {formatDate(event.start_at)}
                </div>

                <div className="text-sm text-slate-500">
                  {formatTime(event.start_at)}
                </div>
              </div>

            </div>

            <div className="flex gap-3">

              <div className="text-xl">
                📍
              </div>

              <div>
                <div className="text-sm font-black">
                  {event.venue_name || "Venue to be announced"}
                </div>

                <div className="text-sm text-slate-500">
                  {event.venue_address || "Nairobi, Kenya"}
                </div>
              </div>

            </div>

            <div className="flex gap-3">

              <div className="text-xl">
                💰
              </div>

              <div className="text-sm font-black">
                {formatPrice(event.price, event.currency)}
              </div>

            </div>

          </div>

          <Link
            href={`/events/${event.id}`}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-orange-500 px-6 py-4 text-sm font-black text-white transition hover:bg-orange-600"
          >
            View Featured Event
          </Link>

        </div>

      </div>

    </article>
  );
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
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  if (error) {
    console.error("Error loading events:", error);
  }

  const eventList = (events || []) as Event[];

  const featuredEvents = eventList.filter(
    (event) => event.featured
  );

  const regularEvents = eventList.filter(
    (event) => !event.featured
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black tracking-tight"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

          <nav className="flex items-center gap-5">

            <Link
              href="/"
              className="hidden text-sm font-semibold text-slate-600 hover:text-orange-500 sm:block"
            >
              Home
            </Link>

            <Link
              href="/submit"
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
            >
              List Your Event
            </Link>

          </nav>

        </div>

      </header>

      {/* HERO */}

      <section className="bg-slate-950">

        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">

          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
            SafariPlug Events
          </p>

          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
            Find something happening.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Discover concerts, nightlife, festivals, comedy, food events,
            cultural experiences and more across East Africa.
          </p>

        </div>

      </section>

      {/* FILTER BAR */}

      <section className="border-b border-slate-200 bg-white">

        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 md:grid-cols-3">

          <div>

            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              City
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
              Nairobi
            </div>

          </div>

          <div>

            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Category
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
              All Events
            </div>

          </div>

          <div>

            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              When
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold">
              Upcoming
            </div>

          </div>

        </div>

      </section>

      {/* EVENTS */}

      <section className="mx-auto max-w-7xl px-6 py-14">

        {/* FEATURED */}

        {featuredEvents.length > 0 && (

          <div>

            <div className="mb-7">

              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
                ⭐ Don't miss these
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                Featured Events
              </h2>

              <p className="mt-3 max-w-2xl text-slate-500">
                Hand-picked events getting extra attention on SafariPlug.
              </p>

            </div>

            <div className="space-y-7">

              {featuredEvents.map((event) => (
                <FeaturedEventCard
                  key={event.id}
                  event={event}
                />
              ))}

            </div>

          </div>

        )}

        {/* REGULAR EVENTS */}

        <div className={featuredEvents.length > 0 ? "mt-16" : ""}>

          <div className="flex items-end justify-between gap-5">

            <div>

              <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
                Upcoming
              </p>

              <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                {featuredEvents.length > 0
                  ? "More events to explore"
                  : "Events worth checking out"}
              </h2>

            </div>

            <div className="hidden text-sm font-semibold text-slate-500 sm:block">
              {eventList.length}{" "}
              {eventList.length === 1 ? "event" : "events"}
            </div>

          </div>

          {eventList.length === 0 ? (

            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">

              <div className="text-5xl">
                🎉
              </div>

              <h3 className="mt-5 text-2xl font-black">
                Nothing upcoming yet
              </h3>

              <p className="mx-auto mt-3 max-w-lg text-slate-500">
                Check back soon for concerts, parties, festivals,
                experiences and other things happening around East Africa.
              </p>

              <Link
                href="/submit"
                className="mt-7 inline-flex rounded-full bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-600"
              >
                List an Event
              </Link>

            </div>

          ) : regularEvents.length === 0 ? (

            <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-10 text-center">

              <div className="text-4xl">
                ⭐
              </div>

              <h3 className="mt-4 text-xl font-black">
                You're all caught up
              </h3>

              <p className="mt-2 text-slate-500">
                All current upcoming events are featured.
              </p>

            </div>

          ) : (

            <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">

              {regularEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                />
              ))}

            </div>

          )}

        </div>

      </section>

      {/* ORGANIZER CTA */}

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
                List it on SafariPlug and get discovered by people
                looking for something to do.
              </p>

            </div>

            <Link
              href="/submit"
              className="rounded-full bg-white px-7 py-3.5 text-center font-bold text-orange-600 hover:bg-orange-50"
            >
              Submit Your Event
            </Link>

          </div>

        </div>

      </section>

      {/* FOOTER */}

      <footer className="bg-white">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-10 md:flex-row">

          <div>

            <Link
              href="/"
              className="text-xl font-black"
            >
              Safari<span className="text-orange-500">Plug</span>
            </Link>

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