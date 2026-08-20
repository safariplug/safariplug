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
  booking_url: string | null;
  source_url: string | null;
  organizer_name: string | null;
  organizer_contact: string | null;
  image_url: string | null;
  featured: boolean;
  status: string;
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
  }).format(price);
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80";


export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {

  const { id } = await params;


  const { data, error } = await supabase
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
      booking_url,
      source_url,
      organizer_name,
      organizer_contact,
      image_url,
      featured,
      status
      `
    )
    .eq("id", id)
    .single();


  if (error || !data) {
    console.log("Event loading failed:", error);
    notFound();
  }


  const event = data as Event;


  return (
    <main className="min-h-screen bg-[#fffaf5] text-slate-950">

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-3xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>


          <Link
            href="/events"
            className="rounded-full border px-5 py-3 text-sm font-black hover:border-orange-500"
          >
            ← Back
          </Link>

        </div>
      </header>


      

        <img
  src={event.image_url || FALLBACK_IMAGE}
  alt={event.title}
  className="absolute inset-0 h-full w-full object-cover opacity-70"
/>

<div className="absolute inset-0 bg-black/40" />

<section className="overflow-hidden bg-slate-950">

  <div className="relative h-[600px]">

    <img
      src={event.image_url || FALLBACK_IMAGE}
      alt={event.title}
      className="h-full w-full object-cover"
    />

    <div className="absolute inset-0 bg-black/50" />


    <div className="absolute inset-0 flex items-end">

      <div className="mx-auto w-full max-w-7xl px-6 pb-16">


        <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white">
          {event.category}
        </span>


        <h1 className="mt-6 text-5xl font-black leading-tight text-white md:text-7xl">
          {event.title}
        </h1>


        <div className="mt-8 flex flex-wrap gap-4 text-white">

          <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur">
            📅 {formatDate(event.start_at)}
          </div>


          <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur">
            🕒 {formatTime(event.start_at)}
          </div>


        </div>


      </div>

    </div>

  </div>

</section>      <section className="mx-auto max-w-7xl px-6 py-14">

        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">


          <div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">

              <h2 className="text-3xl font-black">
                About this experience
              </h2>

              <p className="mt-5 whitespace-pre-line text-lg leading-8 text-slate-600">
                {event.description ||
                  "More details about this experience will be announced soon."}
              </p>

            </div>



            <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">

              <h2 className="text-3xl font-black">
                Location
              </h2>

              <div className="mt-5 space-y-3">

                {event.venue_name && (
                  <p className="text-lg font-bold">
                    📍 {event.venue_name}
                  </p>
                )}

                {event.venue_address && (
                  <p className="text-slate-500">
                    {event.venue_address}
                  </p>
                )}

              </div>

            </div>



            <div className="mt-8 rounded-3xl bg-white p-8 shadow-sm">

              <h2 className="text-3xl font-black">
                Organizer
              </h2>


              <p className="mt-5 text-lg font-bold">
                {event.organizer_name || "SafariPlug Partner"}
              </p>


              {event.organizer_contact && (
                <p className="mt-2 text-slate-500">
                  Contact: {event.organizer_contact}
                </p>
              )}

            </div>


          </div>




          <aside>

            <div className="sticky top-10 rounded-3xl bg-white p-8 shadow-xl">

              <p className="text-sm font-black uppercase tracking-widest text-orange-500">
                Tickets
              </p>


              <h3 className="mt-3 text-4xl font-black">
                {formatPrice(event.price, event.currency)}
              </h3>



              {event.booking_url ? (

                <a
                  href={event.booking_url}
                  target="_blank"
                  className="mt-8 block rounded-full bg-orange-500 px-6 py-4 text-center font-black text-white hover:bg-orange-600"
                >
                  Get Tickets →
                </a>

              ) : (

                <button
                  className="mt-8 w-full rounded-full bg-orange-500 px-6 py-4 font-black text-white"
                >
                  Contact Organizer
                </button>

              )}



              {event.source_url && (

                <a
                  href={event.source_url}
                  target="_blank"
                  className="mt-3 block rounded-full border px-6 py-4 text-center font-black hover:border-orange-500"
                >
                  Official Website
                </a>

              )}



              <div className="mt-8 rounded-2xl bg-orange-50 p-5 text-sm leading-6 text-orange-900">

                SafariPlug helps people discover trusted events and experiences across East Africa.

              </div>


            </div>


          </aside>


        </div>


      </section>



      <footer className="border-t bg-white">

        <div className="mx-auto max-w-7xl px-6 py-10">

          <Link
            href="/"
            className="text-3xl font-black"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

          <p className="mt-2 text-sm text-slate-400">
            Discover East Africa.
          </p>

        </div>

      </footer>


    </main>
  );
}