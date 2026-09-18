import Link from "next/link";
import ActivitySearchClient from "./ActivitySearchClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Activities Across Africa | SafariPlug",
  description:
    "Search live Hotelbeds activities and book through SafariPlug with governed checkout and M-Pesa.",
};

export default function ActivitiesPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#070708] text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug Activities</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight md:text-7xl">
            Search live tours, tickets and activities.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
            Search connected Hotelbeds inventory, review the exact modality and cancellation terms, then continue through SafariPlug checkout.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#activity-search" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708]">Search activities →</a>
            <Link href="/experiences" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-bold text-white/80">Browse SafariPlug experiences</Link>
          </div>
        </div>
      </section>

      <section id="activity-search" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <ActivitySearchClient />
      </section>
    </main>
  );
}
