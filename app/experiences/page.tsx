import Link from "next/link";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

export const metadata = {
  title: "Experiences Across Africa | SafariPlug",
  description: "Explore SafariPlug experience collections including nightlife, beaches, safari, food, date nights, live music, and hidden gems.",
};

const experienceCollections = [
  { slug: "nightlife", title: "Nightlife", description: "Parties, clubs, bars and evening experiences worth going out for.", icon: "◉" },
  { slug: "beaches", title: "Beach Experiences", description: "Ocean days, coastal adventures, water activities and seaside escapes.", icon: "≈" },
  { slug: "safari", title: "Safari Experiences", description: "Wildlife, nature and unforgettable adventures across Africa.", icon: "✦" },
  { slug: "food", title: "Food & Dining", description: "Restaurants, tastings, culinary discoveries and memorable meals.", icon: "⌁" },
  { slug: "date-night", title: "Date Night", description: "Romantic places, activities and experiences for two.", icon: "♡" },
  { slug: "live-music", title: "Live Music", description: "Concerts, performances and live entertainment experiences.", icon: "♪" },
  { slug: "hidden-gems", title: "Hidden Gems", description: "Local places and unique experiences that are easy to miss.", icon: "◇" },
];

export default function ExperiencesPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#070708] text-[#f4f0e8]">
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-10 md:px-8 md:pb-20 md:pt-16">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug Experiences</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight text-white md:text-7xl">Find an experience worth remembering.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/55">Start with the kind of day, night or adventure you want. SafariPlug takes you straight into the matching live discovery collection.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/events" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708]">Browse live discovery →</Link><Link href="/concierge" className="rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white/80">Not sure? Ask Concierge</Link></div>
        </div>
      </section>
      <DiscoverySwitcher current="/experiences" />
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="flex items-end justify-between gap-6"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-black/35">Choose your mood</p><h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">What sounds good right now?</h2></div><Link href="/events" className="hidden text-sm font-semibold text-black/50 hover:text-black sm:block">See everything →</Link></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{experienceCollections.map((collection) => <Link key={collection.slug} href={`/experiences/${collection.slug}`} className="group min-h-[230px] rounded-[1.75rem] border border-black/8 bg-white p-7 shadow-[0_18px_60px_-50px_rgba(0,0,0,.5)] transition hover:-translate-y-1 hover:border-[#c9a86a]/55"><div className="flex h-full flex-col justify-between"><span className="text-3xl text-[#9d793e]" aria-hidden="true">{collection.icon}</span><div className="mt-10"><h3 className="font-serif text-3xl font-medium">{collection.title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{collection.description}</p><span className="mt-5 inline-flex text-sm font-bold text-[#8b672f]">Explore →</span></div></div></Link>)}</div>
      </section>
    </main>
  );
}
