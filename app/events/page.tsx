import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import EventFilters from "./components/EventFilters";
import EventSearch from "./components/EventSearch";

type City = {
  id: string;
  name: string;
  country: string;
  slug: string;
  active: boolean;
};

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
  city_id: string | null;
  city: City | null;
};

const CITY_OPTIONS = [
  "Nairobi",
  "Mombasa",
  "Diani",
  "Kilifi",
  "Mtwapa",
  "Malindi",
  "Zanzibar",
  "Kampala",
  "Dar es Salaam",
];

const CATEGORY_OPTIONS = EVENT_CATEGORIES;
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function formatPrice(
  price: number | null,
  currency: string | null
) {
  if (price === null) {
    return "Free";
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency || "KES",
    maximumFractionDigits: 0,
  }).format(price);
}

function matchesCity(event: Event, city: string) {
  if (!city || city === "all") {
    return true;
  }

  return (
    event.city?.slug?.toLowerCase() === city.toLowerCase() ||
    event.city?.name?.toLowerCase() === city.toLowerCase()
  );
}
function matchesSearch(event: Event, search: string) {
  if (!search) {
    return true;
  }

  const searchText = [
    event.title,
    event.description || "",
    event.category,
    event.venue_name || "",
    event.venue_address || "",
    event.city?.name || "",
    event.city?.country || "",
  ]
    .join(" ")
    .toLowerCase();

  return searchText.includes(search.toLowerCase());
}
function matchesCategory(event: Event, category: string) {
  if (!category || category === "all") {
    return true;
  }

  return (
    event.category.toLowerCase() === category.toLowerCase()
  );
}

function matchesWhen(event: Event, when: string) {
  if (when === "upcoming") {
    return true;
  }

  const now = new Date();
  const eventDate = new Date(event.start_at);

  if (when === "today") {
    return (
      eventDate.getFullYear() === now.getFullYear() &&
      eventDate.getMonth() === now.getMonth() &&
      eventDate.getDate() === now.getDate()
    );
  }

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);

  const day = startOfWeek.getDay();
  const difference = day === 0 ? 6 : day - 1;

  startOfWeek.setDate(
    startOfWeek.getDate() - difference
  );

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(
    startOfWeek.getDate() + 7
  );

  if (when === "this-week") {
    return (
      eventDate >= startOfWeek &&
      eventDate < endOfWeek
    );
  }

  if (when === "this-weekend") {
    const saturday = new Date(startOfWeek);

    saturday.setDate(
      startOfWeek.getDate() + 5
    );

    saturday.setHours(0, 0, 0, 0);

    const monday = new Date(saturday);

    monday.setDate(
      saturday.getDate() + 2
    );

    return (
      eventDate >= saturday &&
      eventDate < monday
    );
  }

  if (when === "this-month") {
    return (
      eventDate.getFullYear() === now.getFullYear() &&
      eventDate.getMonth() === now.getMonth()
    );
  }

  return true;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
  city?: string;
  category?: string;
  when?: string;
  search?: string;
}>;
  }) {
  const params = await searchParams;

  const selectedCity =
    params.city || "all";

  const selectedCategory =
    params.category || "all";

  const selectedWhen =
    params.when || "upcoming";
const selectedSearch =
  params.search?.trim() || "";
  /*
   * LOAD ACTIVE CITIES
   */
  const {
    data: cities,
    error: citiesError,
  } = await supabase
    .from("cities")
    .select(
      "id, name, country, slug, active"
    )
    .eq("active", true)
    .order("name", {
      ascending: true,
    });

  if (citiesError) {
    console.error(
      "Error loading cities:",
      citiesError
    );
  }

  const cityList =
    (cities || []) as City[];

  /*
   * CREATE CITY LOOKUP
   *
   * This is the important fix.
   *
   * Events contain city_id.
   * We resolve that ID to the actual
   * city record before filtering/rendering.
   */
  const cityMap =
    new Map<string, City>();

  cityList.forEach((city) => {
    cityMap.set(city.id, city);
  });

  /*
   * LOAD APPROVED EVENTS ONLY
   */
  const {
    data: events,
    error,
  } = await supabase
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
        featured,
        city_id
      `
    )
    .eq("status", "approved")
    .gte(
      "start_at",
      new Date().toISOString()
    )
    .order("featured", {
      ascending: false,
    })
    .order("start_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Error loading events:",
      error
    );
  }

  /*
   * ATTACH CITY OBJECT TO EVERY EVENT
   */
  const allEvents: Event[] =
    (events || []).map((event) => ({
      ...event,
      city: event.city_id
        ? cityMap.get(event.city_id) || null
        : null,
    }));

  /*
   * APPLY FILTERS
   */
  const eventList =
  allEvents.filter((event) => {
    return (
      matchesSearch(
        event,
        selectedSearch
      ) &&
      matchesCity(
        event,
        selectedCity
      ) &&
      matchesCategory(
        event,
        selectedCategory
      ) &&
      matchesWhen(
        event,
        selectedWhen
      )
    );
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* HEADER */}

      <header className="border-b border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black tracking-tight"
          >
            Safari
            <span className="text-orange-500">
              Plug
            </span>
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
            Discover concerts, nightlife,
            festivals, comedy, food events,
            cultural experiences and more
            across East Africa.
          </p>

        </div>

      </section>

      {/* FILTERS */}

      <section className="border-b border-slate-200 bg-white">

  <div className="mx-auto max-w-7xl space-y-5 px-6 py-6">

    <EventSearch
      initialSearch={selectedSearch}
    />

    <EventFilters
            cities={CITY_OPTIONS}
            categories={[...CATEGORY_OPTIONS]}
            selectedCity={selectedCity}
            selectedCategory={selectedCategory}
            selectedWhen={selectedWhen}
          />

        </div>

      </section>

      {/* EVENTS */}

      <section className="mx-auto max-w-7xl px-6 py-14">

        <div className="flex items-end justify-between gap-5">

          <div>

            <p className="text-sm font-bold uppercase tracking-widest text-orange-500">
              {selectedWhen === "upcoming"
                ? "Upcoming"
                : selectedWhen.replace(
                    "-",
                    " "
                  )}
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              Events worth checking out
            </h2>

          </div>

          <div className="hidden text-sm font-semibold text-slate-500 sm:block">

            {eventList.length}{" "}

            {eventList.length === 1
              ? "event"
              : "events"}

          </div>

        </div>

        {/* EVENTS */}

        {eventList.length === 0 ? (

          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">

            <div className="text-5xl">
              🎉
            </div>

            <h3 className="mt-5 text-2xl font-black">
              Nothing found
            </h3>

            <p className="mx-auto mt-3 max-w-lg text-slate-500">
              We could not find events
              matching those filters.
              Try another city, category
              or date range.
            </p>

            <Link
              href="/events"
              className="mt-7 inline-flex rounded-full bg-orange-500 px-6 py-3 font-bold text-white hover:bg-orange-600"
            >
              Show All Events
            </Link>

          </div>

        ) : (

          <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">

            {eventList.map(
              (event) => (

                <article
                  key={event.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >

                  {/* IMAGE */}

                  <div className="relative flex h-56 items-center justify-center overflow-hidden bg-slate-900">

                    {event.image_url ? (

                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="h-full w-full object-cover"
                      />

                    ) : (

                      <div className="text-7xl">

                        {event.category ===
                          "Music & Nightlife"
                          ? "🎵"
                          : event.category ===
                              "Food & Drink"
                            ? "🍽️"
                            : event.category ===
                                "Adventure"
                              ? "🧗"
                              : event.category ===
                                  "Sports"
                                ? "⚽"
                                : event.category ===
                                    "Comedy"
                                  ? "😂"
                                  : "🎉"}

                      </div>

                    )}

                    {event.featured && (

                      <div className="absolute left-4 top-4 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
                        Featured
                      </div>

                    )}

                  </div>

                  {/* CONTENT */}

                  <div className="p-6">

                    <div className="flex items-center justify-between gap-3">

                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-600">
                        {event.category}
                      </span>

                      <span className="text-xs font-semibold text-slate-400">
                        {event.city
                          ? event.city.name
                          : "East Africa"}
                      </span>

                    </div>

                    <h3 className="mt-4 text-xl font-black leading-tight">
                      {event.title}
                    </h3>

                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                      {event.description ||
                        "Discover this event on SafariPlug."}
                    </p>

                    {/* DATE */}

                    <div className="mt-5 flex gap-3">

                      <div className="text-lg">
                        📅
                      </div>

                      <div>

                        <div className="text-sm font-bold">
                          {formatDate(
                            event.start_at
                          )}
                        </div>

                        <div className="text-xs text-slate-500">
                          {formatTime(
                            event.start_at
                          )}
                        </div>

                      </div>

                    </div>

                    {/* VENUE */}

                    <div className="mt-4 flex gap-3">

                      <div className="text-lg">
                        📍
                      </div>

                      <div>

                        <div className="text-sm font-bold">
                          {event.venue_name ||
                            "Venue to be announced"}
                        </div>

                        <div className="text-xs text-slate-500">

                          {event.venue_address ||
                            (
                              event.city
                                ? `${event.city.name}, ${event.city.country}`
                                : "East Africa"
                            )}

                        </div>

                      </div>

                    </div>

                    {/* PRICE */}

                    <div className="mt-4 flex gap-3">

                      <div className="text-lg">
                        💰
                      </div>

                      <div className="text-sm font-bold">
                        {formatPrice(
                          event.price,
                          event.currency
                        )}
                      </div>

                    </div>

                    {/* VIEW EVENT */}

                    <Link
                      href={`/events/${event.id}`}
                      className="mt-7 flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-orange-600"
                    >
                      View Event
                    </Link>

                  </div>

                </article>

              )
            )}

          </div>

        )}

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
                List it on SafariPlug and
                get discovered by people
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

      <footer className="border-t border-slate-200 bg-white">

        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-10 md:flex-row">

          <div>

            <Link
              href="/"
              className="text-xl font-black"
            >
              Safari
              <span className="text-orange-500">
                Plug
              </span>
            </Link>

            <p className="mt-2 text-sm text-slate-500">
              Discover more. Experience more.
            </p>

          </div>

          <p className="text-sm text-slate-400">
            © 2026 SafariPlug
          </p>

        </div>

      </footer>

    </main>
  );
}
