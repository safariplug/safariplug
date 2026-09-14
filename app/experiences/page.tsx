import Link from "next/link";

export const metadata = {
  title: "Experiences Across Africa | SafariPlug",
  description: "Explore SafariPlug experience collections including nightlife, beaches, safari, food, date nights, live music, and hidden gems.",
};

const experienceCollections = [
  {
    slug: "nightlife",
    title: "Nightlife",
    description: "Parties, clubs, bars and evening experiences worth going out for.",
    icon: "◉",
  },
  {
    slug: "beaches",
    title: "Beach Experiences",
    description: "Ocean days, coastal adventures, water activities and seaside escapes.",
    icon: "≈",
  },
  {
    slug: "safari",
    title: "Safari Experiences",
    description: "Wildlife, nature and unforgettable adventures across Africa.",
    icon: "✦",
  },
  {
    slug: "food",
    title: "Food & Dining",
    description: "Restaurants, tastings, culinary discoveries and memorable meals.",
    icon: "⌁",
  },
  {
    slug: "date-night",
    title: "Date Night",
    description: "Romantic places, activities and experiences for two.",
    icon: "♡",
  },
  {
    slug: "live-music",
    title: "Live Music",
    description: "Concerts, performances and live entertainment experiences.",
    icon: "♪",
  },
  {
    slug: "hidden-gems",
    title: "Hidden Gems",
    description: "Local places and unique experiences that are easy to miss.",
    icon: "◇",
  },
];

export default function ExperiencesPage() {
  return (
    <main className="min-h-screen bg-[#070708] text-[#f4f0e8]">
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug Experiences</p>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight text-white md:text-7xl">
              Find an experience worth remembering.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">
              Browse curated experience collections, then open the live SafariPlug listings inside each one.
            </p>
          </div>

          <Link
            href="/events"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 transition hover:border-[#c9a86a]/60 hover:text-[#e7c98d]"
          >
            All discovery <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experienceCollections.map((collection) => (
            <Link
              key={collection.slug}
              href={`/experiences/${collection.slug}`}
              className="group min-h-[240px] rounded-[1.75rem] border border-white/10 bg-[#111114] p-7 transition hover:-translate-y-0.5 hover:border-[#c9a86a]/45 hover:bg-[#151518]"
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-3xl text-[#e7c98d]" aria-hidden="true">{collection.icon}</span>
                <div className="mt-10">
                  <h2 className="font-serif text-3xl font-medium text-white">{collection.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/55">{collection.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#e7c98d]">
                    Explore <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
