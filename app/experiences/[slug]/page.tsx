import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

const categories: Record<
  string,
  { name: string; description: string; eventCategories: string[] }
> = {
  nightlife: {
    name: "Nightlife",
    description:
      "Discover nightlife, parties, clubs, bars and evening experiences across East Africa.",
    eventCategories: ["Music & Nightlife", "Comedy"],
  },
  beaches: {
    name: "Beach Experiences",
    description:
      "Discover beaches, coastal adventures, water activities and seaside experiences.",
    eventCategories: ["Water Activities"],
  },
  safari: {
    name: "Safari Experiences",
    description:
      "Discover wildlife adventures, nature experiences and unforgettable safaris.",
    eventCategories: ["Safari & Wildlife", "Adventure"],
  },
  food: {
    name: "Food & Dining",
    description:
      "Discover restaurants, food experiences, tastings and culinary adventures.",
    eventCategories: ["Food & Drink"],
  },
  "date-night": {
    name: "Date Night",
    description:
      "Discover romantic restaurants, activities and memorable experiences for couples.",
    eventCategories: ["Romantic", "Food & Drink"],
  },
  "live-music": {
    name: "Live Music",
    description:
      "Discover concerts, performances and live entertainment experiences.",
    eventCategories: ["Music & Nightlife"],
  },
  "hidden-gems": {
    name: "Hidden Gems",
    description:
      "Discover unique local experiences and places worth exploring.",
    eventCategories: [
      "Culture & Arts",
      "Adventure",
      "Other",
      "Safari & Wildlife",
      "Water Activities",
    ],
  },
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  venue_name: string | null;
  image_url: string | null;
  cities: { name: string } | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categories[slug];

  return {
    title: category
      ? `${category.name} Experiences in East Africa | SafariPlug`
      : "SafariPlug Experiences",
    description: category?.description || "Discover experiences across East Africa.",
  };
}

export default async function ExperienceCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categories[slug];

  if (!category) notFound();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(
      `
        id,
        title,
        description,
        category,
        venue_name,
        image_url,
        cities:city_id (name)
      `
    )
    .in("category", category.eventCategories)
    .eq("status", "approved")
    .or(`end_at.gte.${now},and(end_at.is.null,start_at.gte.${now})`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Failed to load experience category", { slug, error });
  }

  const events = (data || []) as Event[];

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description,
  };

  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link href="/" className="text-3xl font-black">
            Safari<span className="text-orange-500">Plug</span>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="font-black uppercase tracking-widest text-orange-500">Experiences</p>
        <h1 className="mt-5 text-5xl font-black md:text-7xl">
          {category.name} Experiences Across East Africa
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">
          {category.description}
        </p>

        <h2 className="mt-16 text-3xl font-black">Discover Experiences</h2>

        {events.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
            No upcoming experiences are available in this category yet. Check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-xl"
              >
                {event.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-56 w-full object-cover"
                  />
                )}
                <div className="p-6">
                  <span className="text-sm font-black text-orange-500">{event.category}</span>
                  <h3 className="mt-3 text-2xl font-black">{event.title}</h3>
                  {event.cities?.name && (
                    <p className="mt-3 text-sm text-slate-500">📍 {event.cities.name}</p>
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
