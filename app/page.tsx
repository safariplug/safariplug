import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LOCATIONS } from "@/lib/constants/locations";

const locations = LOCATIONS.map((location) => [
  location.name,
  location.description,
  location.query,
]);

const interestImages: Record<string, string> = {
  "Music & Nightlife":
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85",
  "Food & Drink":
    "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
  Beach:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  Safari:
    "https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1200&q=85",
  Adventure:
    "https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=1200&q=85",
  Culture:
    "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=1200&q=85",
};

const destinationImages: Record<string, string> = {
  Nairobi:
    "https://images.unsplash.com/photo-1610296669228-602fa827fc1f?auto=format&fit=crop&w=1200&q=85",
  Mombasa:
    "https://images.unsplash.com/photo-1565552629473-3c5c6f5b7f3f?auto=format&fit=crop&w=1200&q=85",
  Diani:
    "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85",
  Mtwapa:
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
  Kilifi:
    "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85",
  Watamu:
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85",
  Malindi:
    "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85",
  Lamu:
    "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=85",
  Zanzibar:
    "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=85",
};

const interests = [
  [
    "Music & Nightlife",
    "DJs, live music, parties and late nights",
    "Music%20%26%20Nightlife",
  ],
  [
    "Food & Drink",
    "Restaurants, dinners, cocktails and food spots",
    "Food%20%26%20Drink",
  ],
  ["Beach", "Beach clubs, ocean days and coastal escapes", "Beach"],
  ["Safari", "Wildlife, lodges and unforgettable escapes", "Safari"],
  [
    "Adventure",
    "Outdoor experiences, nature and adrenaline",
    "Adventure",
  ],
  [
    "Culture",
    "Art, heritage, communities and local life",
    "Culture",
  ],
];

export default async function HomePage() {
  const kenyaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
  }).format(new Date());

  const startOfTonight = new Date(
    `${kenyaDate}T18:00:00+03:00`
  );

  const endOfTonight = new Date(
    `${kenyaDate}T23:59:59+03:00`
  );

  const { data: featuredEvent } = await supabase
    .from("events")
    .select(
      "id,title,description,category,start_at,venue_name,price,currency,image_url"
    )
    .eq("status", "approved")
    .eq("featured", true)
    .order("start_at", { ascending: true })
    .limit(1)
    .single();

  const { data: tonightEvents } = await supabase
    .from("events")
    .select(
      "id,title,description,category,start_at,venue_name,price,currency,image_url"
    )
    .eq("status", "approved")
    .gte("start_at", startOfTonight.toISOString())
    .lte("start_at", endOfTonight.toISOString())
    .order("start_at", { ascending: true })
    .limit(3);

  const { data: upcomingEvents } = await supabase
    .from("events")
    .select(
      "id,title,description,category,start_at,venue_name,price,currency,image_url"
    )
    .eq("status", "approved")
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(3);

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#17231d]">
    {/* NAVIGATION */}
    <header className="absolute left-0 right-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center">
          <img
            src="/brand/safariplug-wordmark-light.png"
            alt="SafariPlug"
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-semibold text-white"
          >
            Home
          </Link>

          <Link
            href="/events"
            className="text-sm font-semibold text-white/80 hover:text-white"
          >
            Discover
          </Link>

          <Link
            href="/submit"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur hover:bg-white hover:text-[#17231d]"
          >
            List Your Experience
          </Link>
        </nav>
      </div>
    </header>


    {/* PREMIUM AI HERO */}
    <section className="relative flex min-h-[820px] items-end overflow-hidden bg-[#07110b]">

      <img
        src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2200&q=90"
        alt="East Africa"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06100a]/95 via-[#06100a]/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#111914] via-transparent to-transparent" />


      <div className="relative mx-auto w-full max-w-7xl px-6 pb-28 lg:px-10">

        <div className="max-w-5xl">

          <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">

            <span className="h-2 w-2 rounded-full bg-white" />

            Powered by SafariPlug Intelligence

          </div>


          <h1 className="text-6xl font-black leading-[0.86] tracking-[-0.07em] text-white sm:text-7xl lg:text-[108px]">

            Find what&apos;s
            <br />
            happening.

          </h1>


          <p className="mt-8 max-w-2xl text-xl leading-9 text-white/75">

            AI-powered discovery of events, experiences and places worth knowing across East Africa.

          </p>


          <div className="mt-10 flex flex-col gap-4 sm:flex-row">

            <Link
              href="/events"
              className="rounded-full bg-white px-9 py-4 text-center text-sm font-black text-[#17231d] shadow-2xl hover:-translate-y-1"
            >
              Explore discoveries →
            </Link>


            <Link
              href="/events?when=tonight"
              className="rounded-full border border-white/30 bg-white/10 px-9 py-4 text-center text-sm font-bold text-white backdrop-blur hover:bg-white/20"
            >
              What&apos;s happening tonight
            </Link>

          </div>


          <div className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-3">

            {[
              ["AI Scout", "Finding hidden experiences"],
              ["East Africa", "Cities, coast and safari"],
              ["Always discovering", "New things to do"],
            ].map(([title, text]) => (

              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur"
              >
                <p className="text-sm font-black text-white">
                  {title}
                </p>

                <p className="mt-2 text-xs leading-5 text-white/60">
                  {text}
                </p>

              </div>

            ))}

          </div>

        </div>

      </div>

    </section>



    {/* QUICK DISCOVER */}

    <section className="border-b border-black/5 bg-white">

      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-6 lg:px-10">

        <span className="mr-3 text-xs font-black uppercase tracking-[0.2em] text-[#8a7251]">
          Discover
        </span>


        {[
          ["Tonight", "/events?when=tonight"],
          ["This weekend", "/events?when=this-weekend"],
          ["Experiences", "/events?type=experiences"],
          ["Hidden gems", "/events?type=hidden-gems"],
        ].map(([label, href]) => (

          <Link
            key={label}
            href={href}
            className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-bold hover:bg-[#17231d] hover:text-white"
          >
            {label}
          </Link>

        ))}

      </div>

    </section>


    {/* TONIGHT */}
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">

      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">

        <div>

          <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
            Live discovery
          </p>

          <h2 className="text-5xl font-black tracking-tight">
            What&apos;s happening tonight?
          </h2>

          <p className="mt-4 max-w-xl text-[#687269]">
            SafariPlug finds the places and events worth leaving home for.
          </p>

        </div>


        <Link
          href="/events?when=tonight"
          className="font-bold underline underline-offset-4"
        >
          View tonight →
        </Link>

      </div>
      <div className="mt-10 rounded-[2rem] bg-[#e8e4db] p-8 sm:p-12">

        {tonightEvents && tonightEvents.length > 0 ? (

          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">

            <div>

              <div className="mb-5 text-3xl">
                ✦
              </div>

              <h3 className="text-3xl font-black">
                {tonightEvents[0].title}
              </h3>

              <p className="mt-4 max-w-xl leading-7 text-[#687269]">
                {tonightEvents[0].description ||
                  "A SafariPlug discovery worth experiencing."}
              </p>

              <p className="mt-5 text-sm font-bold">
                {tonightEvents[0].venue_name}
              </p>

            </div>

            <Link
              href={`/events/${tonightEvents[0].id}`}
              className="rounded-full bg-[#17231d] px-7 py-4 text-center text-sm font-black text-white"
            >
              View event →
            </Link>

          </div>

        ) : (

          <div>

            <div className="mb-5 text-3xl">
              ✦
            </div>

            <h3 className="text-3xl font-black">
              Coming up next.
            </h3>

            <p className="mt-4 max-w-xl leading-7 text-[#687269]">
              No events confirmed for tonight yet. Explore upcoming
              experiences across East Africa.
            </p>


            <div className="mt-8 grid gap-3">

              {upcomingEvents?.map((event) => (

                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="rounded-2xl bg-white px-5 py-4 hover:-translate-y-1"
                >

                  <p className="font-bold">
                    {event.title}
                  </p>

                  <p className="mt-1 text-sm text-[#687269]">
                    {event.venue_name}
                  </p>

                </Link>

              ))}

            </div>

          </div>

        )}

      </div>

    </section>



    {/* DISCOVERY PILLARS */}

    <section className="bg-[#17231d] py-24 text-white">

      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
          Explore SafariPlug
        </p>


        <h2 className="mt-4 text-5xl font-black tracking-tight">
          Find your next thing.
        </h2>


        <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-white/10 md:grid-cols-4">

          {[
            ["01","Tonight","What's happening now","/events?when=tonight"],
            ["02","Events","Music, culture and nightlife","/events?type=events"],
            ["03","Experiences","Things worth getting out for","/events?type=experiences"],
            ["04","Hidden Gems","Places most people miss","/events?type=hidden-gems"],
          ].map(([number,title,text,href]) => (

            <Link
              key={number}
              href={href}
              className="flex min-h-[260px] flex-col justify-between bg-[#1f3026] p-8 hover:bg-[#294031]"
            >

              <span className="text-xs font-black text-white/40">
                {number}
              </span>


              <div>

                <h3 className="text-2xl font-black">
                  {title}
                </h3>

                <p className="mt-3 text-sm text-white/60">
                  {text}
                </p>

              </div>

            </Link>

          ))}

        </div>

      </div>

    </section>



    {/* FEATURED */}

    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">

      <div className="flex justify-between items-end">

        <div>

          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
            Editor's discovery
          </p>

          <h2 className="mt-3 text-5xl font-black">
            Worth knowing about.
          </h2>

        </div>

        <span className="text-sm text-[#687269]">
          Selected by SafariPlug AI
        </span>

      </div>



      <Link
        href={featuredEvent ? `/events/${featuredEvent.id}` : "/events"}
        className="mt-12 block overflow-hidden rounded-[2rem] bg-[#17231d] text-white"
      >

        <div className="relative min-h-[520px] p-10 sm:p-14">


          {featuredEvent?.image_url && (

            <img
              src={featuredEvent.image_url}
              alt={featuredEvent.title}
              className="absolute inset-0 h-full w-full object-cover"
            />

          )}


          <div className="absolute inset-0 bg-black/60" />


          <div className="relative z-10 flex h-full flex-col justify-end">

            <span className="mb-6 w-fit rounded-full bg-white/20 px-4 py-2 text-xs font-black uppercase">
              Featured
            </span>


            <h3 className="max-w-3xl text-5xl font-black">
              {featuredEvent?.title || "Discover something new"}
            </h3>


            <p className="mt-5 max-w-2xl text-lg text-white/70">
              {featuredEvent?.description ||
                "An experience selected by SafariPlug intelligence."}
            </p>

          </div>

        </div>

      </Link>

    </section>
    {/* INTERESTS */}

    <section className="bg-[#e9e4d9] py-24">

      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
          Explore by interest
        </p>

        <h2 className="mt-4 text-5xl font-black">
          What are you into?
        </h2>


        <div className="mt-12 grid gap-5 md:grid-cols-3">

          {interests.map(([title, description, category], index) => (

            <Link
              key={title}
              href={`/events?category=${category}`}
              className="group relative min-h-[330px] overflow-hidden rounded-[2rem] bg-black text-white"
            >

              <img
                src={interestImages[title]}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />

              <div className="relative z-10 flex h-full flex-col justify-end p-8">

                <span className="text-xs font-black text-white/50">
                  0{index + 1}
                </span>

                <h3 className="mt-5 text-3xl font-black">
                  {title}
                </h3>

                <p className="mt-3 text-white/70">
                  {description}
                </p>

              </div>

            </Link>

          ))}

        </div>

      </div>

    </section>




    {/* DESTINATIONS */}

    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">

      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
        Explore by destination
      </p>

      <h2 className="mt-4 text-5xl font-black">
        Where are you going?
      </h2>


      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {locations.map(([name, description, query], index) => (

          <Link
            key={name}
            href={`/events?${query}`}
            className="group relative min-h-[250px] overflow-hidden rounded-[1.5rem] bg-black text-white"
          >

            {destinationImages[name] && (

              <img
                src={destinationImages[name]}
                alt={name}
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />

            )}

            <div className="absolute inset-0 bg-black/50" />

            <div className="relative z-10 flex h-full flex-col justify-end p-6">

              <span className="text-xs text-white/50">
                0{index + 1}
              </span>

              <h3 className="mt-8 text-2xl font-black">
                {name}
              </h3>

              <p className="mt-1 text-sm text-white/70">
                {description}
              </p>

            </div>

          </Link>

        ))}

      </div>

    </section>




    {/* AI INTELLIGENCE */}

    <section className="bg-[#c8bca5] py-24">

      <div className="mx-auto max-w-7xl px-6 lg:px-10">

        <div className="grid gap-10 lg:grid-cols-2">

          <h2 className="text-6xl font-black leading-none">
            The internet is noisy.
            <br />
            We find what&apos;s worth doing.
          </h2>


          <div>

            <p className="text-lg leading-8 text-[#4d514a]">

              SafariPlug Intelligence scans the region to surface events,
              experiences and places people would otherwise miss.

            </p>


            <Link
              href="/events"
              className="mt-8 inline-flex rounded-full bg-[#17231d] px-8 py-4 font-bold text-white"
            >
              Explore discoveries →
            </Link>

          </div>

        </div>

      </div>

    </section>




    {/* BUSINESS */}

    <section className="bg-[#17231d] py-24 text-center text-white">

      <div className="mx-auto max-w-4xl px-6">

        <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
          For businesses and creators
        </p>


        <h2 className="mt-5 text-5xl font-black">
          Get discovered by people looking for something to do.
        </h2>


        <p className="mx-auto mt-6 max-w-2xl text-white/60">

          List your event, restaurant, hotel, tour or experience
          and reach travelers and locals across East Africa.

        </p>


        <Link
          href="/submit"
          className="mt-10 inline-flex rounded-full bg-white px-9 py-4 font-black text-[#17231d]"
        >
          List Your Experience →
        </Link>

      </div>

    </section>




    {/* FOOTER */}

    <footer className="bg-[#101812] px-6 py-14 text-white">

      <div className="mx-auto max-w-7xl">

        <img
          src="/brand/safariplug-wordmark-light.png"
          alt="SafariPlug"
          className="h-9"
        />

        <p className="mt-5 max-w-md text-sm text-white/50">
          Discover the places, people and experiences making East Africa worth exploring.
        </p>


        <div className="mt-10 flex gap-8 text-sm text-white/60">

          <Link href="/">Home</Link>
          <Link href="/events">Discover</Link>
          <Link href="/submit">Submit</Link>

        </div>


        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/30">

          © 2026 SafariPlug. Discover what&apos;s happening. Experience more.

        </div>

      </div>

    </footer>


    </main>
  );
}