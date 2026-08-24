import Link from "next/link";
import { supabase } from "@/lib/supabase";

const categories = [
  {
    title: "Music & Nightlife",
    text: "DJs, live music, parties and late nights",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Food & Drink",
    text: "Restaurants, cocktails and local favourites",
    image:
      "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Beach",
    text: "Coastal escapes and ocean experiences",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  },
];

export default async function HomePage() {
  const { data: featured } = await supabase
    .from("events")
    .select(
      "id,title,description,image_url,venue_name,start_at,price,currency"
    )
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: upcoming } = await supabase
    .from("events")
    .select(
      "id,title,description,image_url,venue_name,start_at"
    )
    .eq("status", "approved")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(3);

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-[#17231d]">

      <header className="absolute top-0 z-50 w-full">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">

          <Link href="/">
            <img
              src="/brand/safariplug-wordmark-light.png"
              alt="SafariPlug"
              className="h-10"
            />
          </Link>

          <nav className="hidden gap-8 md:flex">

            <Link
              href="/events"
              className="font-semibold text-white"
            >
              Discover
            </Link>

            <Link
              href="/submit"
              className="rounded-full bg-white px-5 py-2 font-bold"
            >
              List Experience
            </Link>

          </nav>

        </div>
      </header>


      <section className="relative flex min-h-[760px] items-end overflow-hidden">

        <img
          src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2200&q=90"
          alt="East Africa"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/50" />


        <div className="relative mx-auto max-w-7xl px-6 pb-32">

          <p className="mb-6 text-xs font-black uppercase tracking-[0.3em] text-white/70">
            East Africa Discovery Platform
          </p>


          <h1 className="max-w-5xl text-6xl font-black leading-none tracking-tight text-white md:text-8xl">
            Find what's happening.
          </h1>


          <p className="mt-8 max-w-2xl text-xl text-white/80">
            Events, experiences and places worth discovering across East Africa.
          </p>


          <div className="mt-10 flex gap-4">

            <Link
              href="/events"
              className="rounded-full bg-white px-8 py-4 font-black"
            >
              Explore Events
            </Link>


            <Link
              href="/events?when=tonight"
              className="rounded-full border border-white/40 px-8 py-4 font-bold text-white"
            >
              Tonight
            </Link>

          </div>

        </div>

      </section>



      <section className="mx-auto max-w-7xl px-6 py-20">

        <p className="text-xs font-black uppercase tracking-widest text-[#8a7251]">
          Featured
        </p>


        <h2 className="mt-3 text-5xl font-black">
          Worth knowing about.
        </h2>


        {featured && (

          <Link
            href={`/events/${featured.id}`}
            className="mt-10 block overflow-hidden rounded-[2rem] bg-white shadow-xl"
          >

            {featured.image_url && (
              <img
                src={featured.image_url}
                alt={featured.title}
                className="h-[420px] w-full object-cover"
              />
            )}

            <div className="p-10">

              <h3 className="text-4xl font-black">
                {featured.title}
              </h3>

              <p className="mt-4 text-lg text-gray-600">
                {featured.description}
              </p>

              <p className="mt-5 font-bold">
                {featured.venue_name}
              </p>

            </div>

          </Link>

        )}

      </section>



      <section className="bg-[#17231d] py-20 text-white">

        <div className="mx-auto max-w-7xl px-6">

          <h2 className="text-5xl font-black">
            Explore your way.
          </h2>


          <div className="mt-10 grid gap-6 md:grid-cols-3">

            {categories.map((item)=>(
              <Link
                href="/events"
                key={item.title}
                className="relative h-80 overflow-hidden rounded-3xl"
              >

                <img
                  src={item.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-black/50"/>

                <div className="relative flex h-full flex-col justify-end p-8">

                  <h3 className="text-3xl font-black">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-white/70">
                    {item.text}
                  </p>

                </div>

              </Link>
            ))}

          </div>

        </div>

      </section>



      <section className="mx-auto max-w-7xl px-6 py-20">

        <h2 className="text-5xl font-black">
          Upcoming
        </h2>


        <div className="mt-10 grid gap-6 md:grid-cols-3">

        {upcoming?.map(event=>(

          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="rounded-3xl bg-white p-6 shadow"
          >

            <h3 className="text-2xl font-black">
              {event.title}
            </h3>

            <p className="mt-3 text-gray-600">
              {event.venue_name}
            </p>

          </Link>

        ))}

        </div>

      </section>



      <section className="bg-[#17231d] py-20 text-center text-white">

        <h2 className="text-5xl font-black">
          Have something worth discovering?
        </h2>

        <Link
          href="/submit"
          className="mt-8 inline-block rounded-full bg-white px-8 py-4 font-black text-[#17231d]"
        >
          List Your Experience
        </Link>

      </section>


      <footer className="bg-black px-6 py-10 text-white/60">

        © 2026 SafariPlug — Discover more. Experience more.

      </footer>


    </main>
  );
}