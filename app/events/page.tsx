import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import EventFilters from "./components/EventFilters";
import EventSearch from "./components/EventSearch";
import EventCard from "./components/EventCard";
import { LOCATIONS } from "@/lib/constants/locations";

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

const CITY_OPTIONS = LOCATIONS.map((location) => location.name);

const CATEGORY_OPTIONS = [...EVENT_CATEGORIES];

function matchesCity(event: Event, city: string) {
  if (!city || city === "all") {
    return true;
  }

  const selected = city.toLowerCase();

  return (
    event.city?.slug?.toLowerCase() === selected ||
    event.city?.name?.toLowerCase() === selected
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
    event.category.toLowerCase() ===
    category.toLowerCase()
  );
}

/*
 * DATE FILTERING
 *
 * All calendar calculations use Africa/Nairobi.
 * This prevents the user's computer timezone from
 * changing which events appear in date filters.
 */
function matchesWhen(event: Event, when: string) {
  const eventDate = new Date(event.start_at);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  const now = new Date();

  const getNairobiParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) =>
      Number(
        parts.find((part) => part.type === type)?.value || 0
      );

    return {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: get("hour"),
      minute: get("minute"),
      second: get("second"),
    };
  };

  const eventParts = getNairobiParts(eventDate);
  const nowParts = getNairobiParts(now);

  const dayNumber = (
    year: number,
    month: number,
    day: number
  ) => {
    return Date.UTC(year, month - 1, day);
  };

  const eventDay = dayNumber(
    eventParts.year,
    eventParts.month,
    eventParts.day
  );

  const todayDay = dayNumber(
    nowParts.year,
    nowParts.month,
    nowParts.day
  );

  const DAY_MS = 24 * 60 * 60 * 1000;

  /*
   * UPCOMING
   *
   * Any event that has not started yet.
   */
  if (!when || when === "all") {
  return true;
}

  /*
   * TODAY
   *
   * Today in Nairobi and not already started.
   */
  if (when === "today") {
    return (
      eventDay === todayDay &&
      eventDate.getTime() >= now.getTime()
    );
  }

  /*
   * TONIGHT
   *
   * Today in Nairobi, starting at 5:00 PM,
   * and the event has not already started.
   */
  if (when === "tonight") {
    if (eventDay !== todayDay) {
      return false;
    }

    const eventMinutes =
      eventParts.hour * 60 +
      eventParts.minute;

    const tonightStart = 17 * 60;

    return (
      eventMinutes >= tonightStart &&
      eventDate.getTime() >= now.getTime()
    );
  }

  /*
   * Determine today's weekday using the Nairobi
   * calendar date.
   *
   * Sunday = 0
   * Monday = 1
   * ...
   * Saturday = 6
   */
  const todayWeekday =
    new Date(todayDay).getUTCDay();

  /*
   * THIS WEEKEND
   *
   * Saturday and Sunday of the upcoming/current
   * weekend.
   */
  if (when === "this-weekend") {
    let daysUntilSaturday =
      (6 - todayWeekday + 7) % 7;

    /*
     * If today is Sunday, use the following Saturday.
     */
    if (todayWeekday === 0) {
      daysUntilSaturday = 6;
    }

    const saturdayDay =
      todayDay +
      daysUntilSaturday * DAY_MS;

    const sundayDay =
      saturdayDay + DAY_MS;

    return (
      (eventDay === saturdayDay ||
        eventDay === sundayDay) &&
      eventDate.getTime() >= now.getTime()
    );
  }

  /*
   * THIS WEEK
   *
   * Sunday through Saturday based on the
   * Nairobi calendar.
   */
  if (when === "this-week") {
    const startOfWeekDay =
      todayDay -
      todayWeekday * DAY_MS;

    const endOfWeekDay =
      startOfWeekDay + 6 * DAY_MS;

    return (
      eventDay >= startOfWeekDay &&
      eventDay <= endOfWeekDay &&
      eventDate.getTime() >= now.getTime()
    );
  }

  /*
   * THIS MONTH
   *
   * Current Nairobi calendar month and future only.
   */
  if (when === "this-month") {
    return (
      eventParts.year === nowParts.year &&
      eventParts.month === nowParts.month &&
      eventDate.getTime() >= now.getTime()
    );
  }

  /*
   * Unknown filter values must never mean
   * "show everything."
   */
  return false;
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
    params.when || "all";

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
   */
  const cityMap =
    new Map<string, City>();

  cityList.forEach((city) => {
    cityMap.set(city.id, city);
  });

  /*
   * LOAD APPROVED EVENTS
   */
  const {
    data: events,
    error: eventsError,
  } = await supabase
    .from("events")
    .select(
`
id,
title,
description,
category,
currency,
price,
image_url,
featured,
city_id,
start_at,
end_at,
venue_name,
venue_address
`
)
    .in("status", ["approved", "published"])
    .order("featured", {
      ascending: false,
    })
    .order("start_at", {
      ascending: true,
    });

  if (eventsError) {
    console.error(
      "Error loading events:",
      eventsError
    );
  }

  /*
   * ATTACH CITY DATA
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
    allEvents.filter(
      (event) =>
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
            categories={CATEGORY_OPTIONS}
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

            {eventList.map((event) => (
              <EventCard
                key={event.id}
                event={event}
              />
            ))}

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