import { createClient } from "@supabase/supabase-js";
import EventCard from "@/components/EventCard";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    when?: string;
    city?: string;
    search?: string;
  }>;
}) {
  const now = new Date();
  const today = now.toISOString();
  const params = await searchParams;
  const requestedCategory = params.category?.trim() || "";
  const category = EVENT_CATEGORIES.find(
    (value) => value.toLowerCase() === requestedCategory.toLowerCase()
  ) || requestedCategory;
  const when = params.when?.trim().toLowerCase() || "";
  const city = params.city?.trim().toLowerCase() || "";
  const search = params.search?.trim().toLowerCase() || "";

  const kenyaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
  }).format(new Date());
  const startOfTonight = new Date(`${kenyaDate}T18:00:00+03:00`);
  const endOfTonight = new Date(`${kenyaDate}T23:59:59+03:00`);
  const kenyaWeekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
  }).format(new Date());
  const weekdayNumbers: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const currentWeekday = weekdayNumbers[kenyaWeekday];
  const daysUntilSaturday =
    currentWeekday === 0
      ? 1
      : currentWeekday === 6
        ? 0
        : 6 - currentWeekday;
  const nairobiMidnight = new Date(`${kenyaDate}T00:00:00+03:00`);
  const startOfSaturday = new Date(
    nairobiMidnight.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000
  );
  const startOfMonday = new Date(
    startOfSaturday.getTime() + 2 * 24 * 60 * 60 * 1000
  );

  let eventsQuery = supabase
    .from("events")
    .select("id, title, description, category, venue_name, price, currency, image_url, start_at, is_featured, status, cities ( name, country )")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("start_at", { ascending: true });

  if (category && category.toLowerCase() !== "all") {
    eventsQuery = eventsQuery.eq("category", category);
  }

  if (when === "tonight") {
    eventsQuery = eventsQuery
      .gte("start_at", startOfTonight.toISOString())
      .lte("start_at", endOfTonight.toISOString());
  } else if (when === "this-weekend") {
    eventsQuery = eventsQuery
      .gte(
        "start_at",
        new Date(
          Math.max(startOfSaturday.getTime(), now.getTime())
        ).toISOString()
      )
      .lt("start_at", startOfMonday.toISOString());
  } else {
    eventsQuery = eventsQuery.gte("start_at", today);
  }

  const { data: events, error } = await eventsQuery;

  const normalizedEvents = (events || []).map((event) => {
    const related = event.cities;
    const row = Array.isArray(related) ? related[0] : related;
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const country = typeof row?.country === "string" ? row.country : "";
    return {
      ...event,
      city: name ? { name, country } : null,
    };
  });

  const filteredEvents = normalizedEvents.filter((event) => {
    const eventCity = (event.city?.name || "").toLowerCase();
    const searchText = [
      event.title,
      event.description || "",
      event.category || "",
      event.venue_name || "",
      eventCity,
    ]
      .join(" ")
      .toLowerCase();

    return (!city || eventCity === city) &&
      (!search || searchText.includes(search));
  });

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

        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 py-20 text-center">
            <p className="text-gray-400">
              No upcoming approved experiences found at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
