import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type City = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
};

type Event = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  category: string;
  start_at: string;
  end_at: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url: string | null;
  source_url: string | null;
  organizer_name: string | null;
  organizer_contact: string | null;
  featured: boolean;
  status: string;
  city_id: string | null;
  cities: City | City[] | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
    day: "numeric",
    month: "long",
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
  }).format(Number(price));
}

export default async function EventDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      slug,
      description,
      venue_name,
      venue_address,
      category,
      start_at,
      end_at,
      price,
      currency,
      image_url,
      booking_url,
      source_url,
      organizer_name,
      organizer_contact,
      featured,
      status,
      city_id,
      cities (
        id,
        name,
        slug,
        country
      )
    `)
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error || !data) {
    console.error("Error loading event:", error);
    notFound();
  }

  const event = data as Event;

  const city = Array.isArray(event.cities)
    ? event.cities[0]
    : event.cities;

  const formattedDate = formatDate(event.start_at);
  const formattedTime = formatTime(event.start_at);

  const formattedEndTime = event.end_at
    ? formatTime(event.end_at)
    : null;

  const formattedPrice = formatPrice(
    event.price,
    event.currency
  );

  const requestHeaders = await headers();

  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";

  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");

  const publicUrl =
    `${protocol}://${host}/events/${event.id}`;

  const shareText =
    `${event.title} - ${publicUrl}`;

  const locationParts = [
    event.venue_name,
    event.venue_address,
    city?.name,
    city?.country,
  ].filter(Boolean);

  const locationText = locationParts.join(", ");

  const mapUrl = locationText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        locationText
      )}`
    : null;

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

          <nav className="flex items-center gap-3">

            <Link
              href="/events"
              className="hidden rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:block"
            >
              All Events
            </Link>

            <Link
              href="/submit"
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-black text-white hover:bg-orange-600"
            >
              List Your Event
            </Link>

          </nav>

        </div>
      </header>

      {/* MAIN */}

      <section className="mx-auto max-w-6xl px-6 py-10">

        {/* BACK */}

        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-orange-500"
        >
          ← Back to events
        </Link>

        {/* HERO */}

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {event.image_url ? (

            <div className="h-72 w-full overflow-hidden bg-slate-100 md:h-96">
              <img
                src={event.image_url}
                alt={event.title}
                className="h-full w-full object-cover"
              />
            </div>

          ) : (

            <div className="flex h-64 items-center justify-center bg-gradient-to-br from-orange-100 via-white to-slate-100 md:h-80">

              <div className="text-7xl">
                🎉
              </div>

            </div>

          )}

          <div className="p-7 md:p-10">

            <div className="flex flex-wrap items-center gap-3">

              <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-700">
                {event.category}
              </span>

              {event.featured && (
                <span className="rounded-full bg-yellow-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-yellow-700">
                  Featured
                </span>
              )}

              {city?.name && (
                <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                  {city.name}
                </span>
              )}

            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-5xl">
              {event.title}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-medium text-slate-500">

              <span>
                {formattedDate}
              </span>

              <span className="text-slate-300">
                •
              </span>

              <span>
                {formattedTime}
              </span>

              {formattedEndTime && (
                <>
                  <span className="text-slate-300">
                    –
                  </span>

                  <span>
                    {formattedEndTime}
                  </span>
                </>
              )}

            </div>

          </div>

        </div>

        {/* CONTENT */}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">

          <div className="space-y-8">

            {/* ABOUT */}

            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-8">

              <h2 className="text-2xl font-black">
                About this event
              </h2>

              <div className="mt-5">

                {event.description ? (

                  <p className="whitespace-pre-line leading-8 text-slate-600">
                    {event.description}
                  </p>

                ) : (

                  <p className="text-slate-500">
                    More information about this event will be available soon.
                  </p>

                )}

              </div>

            </section>

            {/* LOCATION */}

            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-8">

              <h2 className="text-2xl font-black">
                Location
              </h2>

              <div className="mt-6 flex gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xl">
                  📍
                </div>

                <div>

                  <h3 className="font-black">
                    {event.venue_name ||
                      "Venue to be announced"}
                  </h3>

                  {event.venue_address && (
                    <p className="mt-1 text-slate-500">
                      {event.venue_address}
                    </p>
                  )}

                  {city?.name && (
                    <p className="mt-1 text-slate-500">
                      {city.name}
                      {city.country
                        ? `, ${city.country}`
                        : ""}
                    </p>
                  )}

                </div>

              </div>

              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 block rounded-2xl bg-slate-100 px-5 py-4 text-center text-sm font-black text-slate-700 hover:bg-slate-200"
                >
                  Open Location in Google Maps
                </a>
              )}

            </section>

            {/* SHARE */}

            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-8">

              <h2 className="text-2xl font-black">
                Share this event
              </h2>

              <p className="mt-2 text-slate-500">
                Let your friends know about something happening.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    shareText
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700"
                >
                  Share on WhatsApp
                </a>

                {event.source_url && (
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                  >
                    Original Event
                  </a>
                )}

              </div>

            </section>

          </div>

          {/* SIDEBAR */}

          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

            <h2 className="text-xl font-black">
              Event details
            </h2>

            <div className="mt-6 space-y-6">

              {/* DATE */}

              <div>

                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Date
                </p>

                <p className="mt-2 font-bold">
                  {formattedDate}
                </p>

                <p className="mt-1 text-slate-500">
                  {formattedTime}

                  {formattedEndTime && (
                    <>
                      {" – "}
                      {formattedEndTime}
                    </>
                  )}
                </p>

              </div>

              {/* VENUE */}

              <div>

                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Venue
                </p>

                <p className="mt-2 font-bold">
                  {event.venue_name ||
                    "To be announced"}
                </p>

                {event.venue_address && (
                  <p className="mt-1 text-slate-500">
                    {event.venue_address}
                  </p>
                )}

                {city?.name && (
                  <p className="mt-1 text-slate-500">
                    {city.name}
                    {city.country
                      ? `, ${city.country}`
                      : ""}
                  </p>
                )}

              </div>

              {/* PRICE */}

              <div>

                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Price
                </p>

                <p className="mt-2 text-xl font-black text-orange-600">
                  {formattedPrice}
                </p>

              </div>

              {/* ORGANIZER */}

              {event.organizer_name && (

                <div>

                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Organizer
                  </p>

                  <p className="mt-2 font-bold">
                    {event.organizer_name}
                  </p>

                  {event.organizer_contact && (
                    <p className="mt-1 text-sm text-slate-500">
                      {event.organizer_contact}
                    </p>
                  )}

                </div>

              )}

              {/* BOOKING */}

              {event.booking_url && (

                <a
                  href={event.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl bg-orange-500 px-5 py-4 text-center font-black text-white hover:bg-orange-600"
                >
                  Get Tickets / Book
                </a>

              )}

            </div>

          </aside>

        </div>

        {/* ORGANIZER CTA */}

        <section className="mt-10 rounded-3xl bg-slate-900 p-8 text-white md:p-10">

          <h2 className="text-3xl font-black">
            Want more people to discover your event?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-slate-300">
            List your event on SafariPlug and reach people actively looking for something to do.
          </p>

          <Link
            href="/submit"
            className="mt-7 inline-flex rounded-full bg-orange-500 px-6 py-3.5 font-black text-white hover:bg-orange-600"
          >
            List Your Event
          </Link>

        </section>

      </section>

      {/* FOOTER */}

      <footer className="mt-12 border-t border-slate-200 bg-white">

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