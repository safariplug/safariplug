import { createClient } from "@supabase/supabase-js";
import EventCard from "@/components/EventCard";
import EventFilters from "@/app/events/components/EventFilters";
import EventSearch from "@/app/events/components/EventSearch";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAY_MS = 24 * 60 * 60 * 1000;

function kenyaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(date);
}

function kenyaDateAt(dateString: string, time: string) {
  return new Date(`${dateString}T${time}+03:00`);
}

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
  const params = await searchParams;
  const requestedCategory = params.category?.trim() || "";
  const category = EVENT_CATEGORIES.find(
    (value) => value.toLowerCase() === requestedCategory.toLowerCase()
  ) || requestedCategory;
  const when = params.when?.trim().toLowerCase() || "upcoming";
  const city = params.city?.trim() || "";
  const search = params.search?.trim().toLowerCase() || "";

  const kenyaToday = kenyaDateString(now);
  const kenyaMidnight = kenyaDateAt(kenyaToday, "00:00:00");
  const kenyaWeekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
  }).format(now);
  const weekdayNumbers: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const currentWeekday = weekdayNumbers[kenyaWeekday] ?? 0;
  const daysUntilSaturday = currentWeekday === 6 ? 0 : 6 - currentWeekday;
  const startOfSaturday = new Date(kenyaMidnight.getTime() + daysUntilSaturday * DAY_MS);
  const startOfMonday = new Date(startOfSaturday.getTime() + 2 * DAY_MS);
  const startOfNextDay = new Date(kenyaMidnight.getTime() + DAY_MS);
  const startOfNextWeek = new Date(kenyaMidnight.getTime() + (7 - currentWeekday) * DAY_MS);
  const monthStart = kenyaDateAt(kenyaToday.slice(0, 7) + "-01", "00:00:00");
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  let eventsQuery = supabase
    .from("events")
    .select("id, title, description, category, venue_name, price, currency, image_url, start_at, is_featured, status, cities ( name, country )")
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("start_at", { ascending: true });

  if (category && category.toLowerCase() !== "all") eventsQuery = eventsQuery.eq("category", category);

  if (when === "tonight") {
    eventsQuery = eventsQuery.gte("start_at", kenyaDateAt(kenyaToday, "18:00:00").toISOString()).lt("start_at", kenyaDateAt(kenyaToday, "23:59:59").toISOString());
  } else if (when === "today") {
    eventsQuery = eventsQuery.gte("start_at", now.toISOString()).lt("start_at", startOfNextDay.toISOString());
  } else if (when === "this-weekend") {
    eventsQuery = eventsQuery.gte("start_at", new Date(Math.max(startOfSaturday.getTime(), now.getTime())).toISOString()).lt("start_at", startOfMonday.toISOString());
  } else if (when === "this-week") {
    eventsQuery = eventsQuery.gte("start_at", now.toISOString()).lt("start_at", startOfNextWeek.toISOString());
  } else if (when === "this-month") {
    eventsQuery = eventsQuery.gte("start_at", now.toISOString()).lt("start_at", monthEnd.toISOString());
  } else {
    eventsQuery = eventsQuery.gte("start_at", now.toISOString());
  }

  const { data: events, error } = await eventsQuery;
  if (error) console.error("Supabase events fetch error:", error.message);

  const normalizedEvents = (events || []).map((event) => {
    const related = event.cities;
    const row = Array.isArray(related) ? related[0] : related;
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    const country = typeof row?.country === "string" ? row.country : "";
    return { ...event, city: name ? { name, country } : null };
  });

  const filteredEvents = normalizedEvents.filter((event) => {
    const eventCity = (event.city?.name || "").toLowerCase();
    const searchText = [event.title, event.description || "", event.category || "", event.venue_name || "", eventCity].join(" ").toLowerCase();
    return (!city || eventCity === city.toLowerCase()) && (!search || searchText.includes(search));
  });

  const cities = Array.from(new Set(normalizedEvents.map((event) => event.city?.name).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-amber-400">SafariPlug Discovery</p>
              <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Discover what&apos;s happening</h1>
              <p className="mt-3 max-w-2xl text-gray-400">Curated events, experiences and adventures across East Africa — searched and filtered in one place.</p>
            </div>
            <div className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-semibold text-zinc-300">
              {filteredEvents.length} {filteredEvents.length === 1 ? "experience" : "experiences"}
            </div>
          </div>
        </header>

        <section className="mb-8 space-y-4">
          <EventSearch initialSearch={params.search || ""} />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <EventFilters
              cities={cities}
              categories={EVENT_CATEGORIES}
              selectedCity={city || "all"}
              selectedCategory={category || "all"}
              selectedWhen={when}
            />
          </div>
        </section>

        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-20 text-center">
            <p className="text-2xl font-bold text-white">Nothing matches yet</p>
            <p className="mx-auto mt-2 max-w-lg text-gray-400">Try a different city, category, date range or search term. SafariPlug only shows approved upcoming experiences.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </div>
    </main>
  );
}
