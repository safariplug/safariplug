import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_CATEGORIES } from "@/lib/constants/events";
import { applyDateMode } from "./dates";
import type { DateMode } from "./params";
import { paginationRange, sanitizeIlike } from "./params";
import { PUBLIC_EVENT_SELECT, toPublicEvent, type PublicEvent } from "./public-event";

export type CatalogClient = Pick<SupabaseClient, "from">;

export type ListEventsInput = {
  page: number;
  limit: number;
  city?: string;
  category?: string;
  featured?: boolean;
  when: DateMode;
  q?: string;
  now?: Date;
};

export type CatalogOk<T> = {
  ok: true;
  data: T;
  count: number | null;
};

export type CatalogErr = {
  ok: false;
  reason: "db" | "not_found";
};

export type CatalogResult<T> = CatalogOk<T> | CatalogErr;

export const EXPERIENCE_COLLECTIONS = [
  {
    slug: "nightlife",
    name: "Nightlife",
    description:
      "Discover nightlife, parties, clubs, bars and evening experiences across East Africa.",
  },
  {
    slug: "beaches",
    name: "Beach Experiences",
    description:
      "Discover beaches, coastal adventures, water activities and seaside experiences.",
  },
  {
    slug: "safari",
    name: "Safari Experiences",
    description:
      "Discover wildlife adventures, nature experiences and unforgettable safaris.",
  },
  {
    slug: "food",
    name: "Food & Dining",
    description:
      "Discover restaurants, food experiences, tastings and culinary adventures.",
  },
  {
    slug: "date-night",
    name: "Date Night",
    description:
      "Discover romantic restaurants, activities and memorable experiences for couples.",
  },
  {
    slug: "live-music",
    name: "Live Music",
    description:
      "Discover concerts, performances and live entertainment experiences.",
  },
  {
    slug: "hidden-gems",
    name: "Hidden Gems",
    description:
      "Discover unique local experiences and places worth exploring.",
  },
] as const;

export type PublicDestination = {
  id: string;
  name: string;
  country: string | null;
  slug: string;
  event_count: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function eventsTable(client: CatalogClient) {
  return client.from("events");
}

async function resolveCityId(
  client: CatalogClient,
  city: string
): Promise<string | undefined> {
  const needle = sanitizeIlike(city);
  if (!needle) return undefined;
  const { data, error } = await client
    .from("cities")
    .select("id, name")
    .eq("active", true)
    .ilike("name", needle)
    .maybeSingle();
  if (error || !data) return undefined;
  return typeof data.id === "string" ? data.id : undefined;
}

export async function listEvents(
  client: CatalogClient,
  input: ListEventsInput
): Promise<CatalogResult<PublicEvent[]>> {
  const { from, to } = paginationRange(input.page, input.limit);
  const now = input.now ?? new Date();

  let query = eventsTable(client)
    .select(PUBLIC_EVENT_SELECT, { count: "exact" })
    .eq("status", "approved");

  query = applyDateMode(query, input.when, now);

  if (input.featured === true) {
    query = query.eq("is_featured", true);
  } else if (input.featured === false) {
    query = query.eq("is_featured", false);
  }

  if (input.category) {
    query = query.eq("category", input.category);
  }

  if (input.city) {
    const cityId = await resolveCityId(client, input.city);
    const cityText = sanitizeIlike(input.city);
    if (cityId) {
      query = query.or(`city_id.eq.${cityId},city.ilike.${cityText}`);
    } else if (cityText) {
      query = query.ilike("city", cityText);
    }
  }

  if (input.q) {
    const q = sanitizeIlike(input.q);
    if (!q) {
      return { ok: true, data: [], count: 0 };
    }
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,venue_name.ilike.%${q}%,category.ilike.%${q}%,city.ilike.%${q}%`
    );
  }

  const { data, error, count } = await query
    .order("is_featured", { ascending: false })
    .order("start_at", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    console.error("api.v1.events", error.message);
    return { ok: false, reason: "db" };
  }

  const events = (data ?? [])
    .map((row) => toPublicEvent(row))
    .filter((row): row is PublicEvent => row !== null);

  return { ok: true, data: events, count: count ?? events.length };
}

export async function getApprovedEvent(
  client: CatalogClient,
  id: string
): Promise<CatalogResult<PublicEvent>> {
  const { data, error } = await eventsTable(client)
    .select(PUBLIC_EVENT_SELECT)
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    console.error("api.v1.event", error.message);
    return { ok: false, reason: "db" };
  }

  const event = toPublicEvent(data);
  if (!event) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, data: event, count: 1 };
}

export async function listDestinations(
  client: CatalogClient,
  now = new Date()
): Promise<CatalogResult<PublicDestination[]>> {
  const { data: cities, error: cityError } = await client
    .from("cities")
    .select("id, name, country")
    .eq("active", true)
    .order("name", { ascending: true });

  if (cityError) {
    console.error("api.v1.destinations", cityError.message);
    return { ok: false, reason: "db" };
  }

  const { data: eventRows, error: eventError } = await applyDateMode(
    eventsTable(client).select("city_id, city").eq("status", "approved"),
    "valid",
    now
  );

  if (eventError) {
    console.error("api.v1.destinations.events", eventError.message);
    return { ok: false, reason: "db" };
  }

  const counts = new Map<string, number>();
  for (const row of eventRows ?? []) {
    const cityId = typeof row.city_id === "string" ? row.city_id : "";
    const cityName =
      typeof row.city === "string" ? row.city.trim().toLowerCase() : "";
    if (cityId) counts.set(`id:${cityId}`, (counts.get(`id:${cityId}`) ?? 0) + 1);
    if (cityName) {
      counts.set(`name:${cityName}`, (counts.get(`name:${cityName}`) ?? 0) + 1);
    }
  }

  const destinations: PublicDestination[] = (cities ?? [])
    .map((city) => {
      const id = typeof city.id === "string" ? city.id : "";
      const name = typeof city.name === "string" ? city.name : "";
      if (!id || !name) return null;
      const country = typeof city.country === "string" ? city.country : null;
      const event_count =
        counts.get(`id:${id}`) ??
        counts.get(`name:${name.toLowerCase()}`) ??
        0;
      return {
        id,
        name,
        country,
        slug: slugify(name),
        event_count,
      };
    })
    .filter((row): row is PublicDestination => row !== null);

  return { ok: true, data: destinations, count: destinations.length };
}

export type PublicExperienceCollection = {
  slug: string;
  name: string;
  description: string;
  event_count: number;
};

export type PublicExperienceCategory = {
  name: string;
  event_count: number;
};

export type PublicExperiences = {
  collections: PublicExperienceCollection[];
  categories: PublicExperienceCategory[];
};

export async function listExperiences(
  client: CatalogClient,
  now = new Date()
): Promise<CatalogResult<PublicExperiences>> {
  const { data, error } = await applyDateMode(
    eventsTable(client).select("category").eq("status", "approved"),
    "valid",
    now
  );

  if (error) {
    console.error("api.v1.experiences", error.message);
    return { ok: false, reason: "db" };
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const category = typeof row.category === "string" ? row.category.trim() : "";
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const collections = EXPERIENCE_COLLECTIONS.map((collection) => {
    const needle = collection.name.toLowerCase();
    let event_count = 0;
    for (const [category, count] of counts) {
      // Same semantics as app/experiences/[slug]/page.tsx: ilike %name%.
      if (category.toLowerCase().includes(needle)) {
        event_count += count;
      }
    }
    return {
      slug: collection.slug,
      name: collection.name,
      description: collection.description,
      event_count,
    };
  });

  const categories = EVENT_CATEGORIES.map((name) => ({
    name,
    event_count: counts.get(name) ?? 0,
  }));

  return {
    ok: true,
    data: { collections, categories },
    count: collections.length,
  };
}

export async function searchCatalog(
  client: CatalogClient,
  input: Pick<ListEventsInput, "q" | "page" | "limit" | "now">
): Promise<CatalogResult<PublicEvent[]>> {
  return listEvents(client, {
    page: input.page,
    limit: input.limit,
    q: input.q,
    when: "valid",
    now: input.now,
  });
}
