import Link from "next/link";
import { notFound } from "next/navigation";
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
    weekday: "long",
    day: "numeric",
    month: "long",
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
  if (price === null) return "Free";

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: currency || "KES",
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: event, error } = await supabase
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
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error || !event) {
    notFound();
  }

  const typedEvent = event as Event;

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

          <div className="flex items-center gap-4">

            <Link
              href="/events"
              className="hidden text-sm font-semibold text-slate-600 hover:text-orange-500 sm:block"
            >
              All Events
            </Link>

            <Link
              href="/submit"
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
            >
              List Your Event
            </Link>

          </div>

        </div>
      </header>

      {/* EVENT HERO */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-10">

          <Link
            href="/events"
            className="text-sm font-semibold text-slate-400 hover:text-white"
          >
            ← Back to events
          </Link>

          <div className="mt-8 overflow-hidden rounded-3xl bg-slate-900">

            <div className="relative flex min-h-[360px] items-center justify-center bg-slate-800 md:min-h-[480px]">

              {typedEvent.image_url ? (
                <img
                  src={typedEvent.image_url}
                  alt={typedEvent.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="text-8xl">
                  {typedEvent.category === "Nightlife"
                    ? "🎵"
                    : typedEvent.category === "Food"
                      ? "🍽️"
                      : typedEvent.category === "Adventure"
                        ? "🧗"
                        : "🎉"}
                </div>
              )}

              <div className="absolute inset-0 bg-black/20" />

              {typedEvent.featured && (
                <div className="absolute left-6 top-6 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white">
                  Featured Event
                </div>
              )}

            </div>

            <div className="p-7 md:p-10">

              <div className="flex flex-wrap items-center gap-3">

                <span className="rounded-full bg-orange-500/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-orange-400">
                  {typedEvent.category}
                </span>

                <span className="text-sm text-slate-400">
                  SafariPlug
                </span>

              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">
                {typedEvent.title}
              </h1>

            </div>

          </div>

        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_380px]">

        {/* LEFT */}
        <div className="space-y-8">

          {/* ABOUT */}
          <section className="rounded-3xl border border-slate-200 bg-white p-7 md:p-9">

            <h2 className="text-2xl font-black">
              About this event
            </h2>

            <p className="mt-5 whitespace-pre-line text-base leading-8 text-slate-600">
              {typedEvent.description ||
                "More information about this event will be available soon."}
            </p>

          </section>

          {/* LOCATION */}
          <section className="rounded-3xl border border-slate-200 bg-white p-7 md:p-9">

            <h2 className="text-2xl font-black">
              Location
            </h2>

            <div className="mt-6 flex gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xl">
                📍
              </div>

              <div>
                <h3 className="font-bold">
                  {typedEvent.venue_name || "Location to be announced"}
                </h3>

                <p className="mt-1 text-slate-500">
                  {typedEvent.venue_address || "Nairobi, Kenya"}
                </p>
              </div>

            </div>

            {/* MAP PLACEHOLDER */}
            <div className="mt-7 flex h-56 items-center justify-center rounded-2xl bg-slate-100 text-center">

              <div>
                <div className="text-3xl">🗺️</div>
                <p className="mt-2 font-semibold text-slate-600">
                  Map coming soon
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Interactive maps will be added next.
                </p>
              </div>

            </div>

          </section>

          {/* SHARE */}
          <section className="rounded-3xl border border-slate-200 bg-white p-7 md:p-9">

            <h2 className="text-2xl font-black">
              Share this event
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Let your friends know about something happening.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">

              <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold hover:border-orange-500 hover:text-orange-500">
                WhatsApp
              </button>

              <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold hover:border-orange-500 hover:text-orange-500">
                Facebook
              </button>

              <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-bold hover:border-orange-500 hover:text-orange-500">
                Copy Link
              </button>

            </div>

          </section>

        </div>

        {/* RIGHT SIDEBAR */}
        <aside>

          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

            <h2 className="text-xl font-black">
              Event details
            </h2>

            <div className="mt-7 space-y-6">

              {/* DATE */}
              <div className="flex gap-4">

                <div className="text-xl">
                  📅
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                  </div>

                  <div className="mt-1 font-bold">
                    {formatDate(typedEvent.start_at)}
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    {formatTime(typedEvent.start_at)}
                  </div>
                </div>

              </div>

              {/* VENUE */}
              <div className="flex gap-4">

                <div className="text-xl">
                  📍
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Venue
                  </div>

                  <div className="mt-1 font-bold">
                    {typedEvent.venue_name || "To be announced"}
                  </div>

                  {typedEvent.venue_address && (
                    <div className="mt-1 text-sm text-slate-500">
                      {typedEvent.venue_address}
                    </div>
                  )}
                </div>

              </div>

              {/* PRICE */}
              <div className="flex gap-4">

                <div className="text-xl">
                  💰
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Price
                  </div>

                  <div className="mt-1 text-lg font-black">
                    {formatPrice(
                      typedEvent.price,
                      typedEvent.currency
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* ACTION */}
            <button className="mt-8 w-full rounded-xl bg-orange-500 px-6 py-4 font-black text-white hover:bg-orange-600">
              Get Tickets / Book
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              Ticketing and booking options will be available here.
            </p>

          </div>

        </aside>

      </section>

      {/* BUSINESS CTA */}
      <section className="bg-orange-500">

        <div className="mx-auto max-w-7xl px-6 py-16">

          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">

            <div>

              <p className="font-bold uppercase tracking-widest text-orange-100">
                Event organizers
              </p>

              <h2 className="mt-2 text-3xl font-black text-white">
                Want more people to discover your event?
              </h2>

              <p className="mt-3 max-w-xl text-orange-50">
                List your event on SafariPlug and reach people actively
                looking for something to do.
              </p>

            </div>

            <Link
              href="/submit"
              className="rounded-full bg-white px-7 py-3.5 text-center font-bold text-orange-600 hover:bg-orange-50"
            >
              List Your Event
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