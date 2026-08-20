import Link from "next/link";
import { supabase } from "@/lib/supabase";

const locations = [
  ["Nairobi", "City energy", "city=Nairobi"],
  ["Mombasa", "Coastal culture", "city=Mombasa"],
  ["Diani", "Beach life", "city=Diani"],
  ["Mtwapa", "Coastal nights", "city=Mtwapa"],
  ["Kilifi", "Slow coastal living", "city=Kilifi"],
  ["Watamu", "Ocean escapes", "city=Watamu"],
  ["Malindi", "Indian Ocean charm", "city=Malindi"],
  ["Lamu", "Old-world magic", "city=Lamu"],
];

const interests = [
  ["Music & Nightlife", "DJs, live music, parties and late nights", "Music%20%26%20Nightlife"],
  ["Food & Drink", "Restaurants, dinners, cocktails and food spots", "Food%20%26%20Drink"],
  ["Beach", "Beach clubs, ocean days and coastal escapes", "Beach"],
  ["Safari", "Wildlife, lodges and unforgettable escapes", "Safari"],
  ["Adventure", "Outdoor experiences, nature and adrenaline", "Adventure"],
  ["Culture", "Art, heritage, communities and local life", "Culture"],
];

export default async function HomePage() {
  const kenyaNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const startOfTonight = new Date(kenyaNow);
  startOfTonight.setHours(18, 0, 0, 0);

  const endOfTonight = new Date(kenyaNow);
  endOfTonight.setHours(23, 59, 59, 999);

  const { data: featuredEvent } = await supabase
    .from("events")
    .select("id, title, description, category, start_at, venue_name, price, currency")
    .eq("status", "approved")
    .eq("featured", true)
    .order("start_at", { ascending: true })
    .limit(1)
    .single();

  const { data: tonightEvents } = await supabase
    .from("events")
    .select("id, title, description, start_at, venue_name, price, currency")
    .eq("status", "approved")
    .gte("start_at", startOfTonight.toISOString())
    .lte("start_at", endOfTonight.toISOString())
    .order("start_at", { ascending: true })
    .limit(3);

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#17231d]">
      {/* NAVIGATION */}
      <header className="absolute left-0 right-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm">
              S
            </span>

            <div>
              <div className="text-lg font-black tracking-tight text-white">
                SafariPlug
              </div>
              <div className="hidden text-[9px] font-bold uppercase tracking-[0.28em] text-white/60 sm:block">
                East Africa Experience Platform
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/"
              className="text-sm font-semibold text-white transition hover:text-white/70"
            >
              Home
            </Link>

            <Link
              href="/events"
              className="text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Discover
            </Link>

            <Link
              href="/submit"
              className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white hover:text-[#17231d]"
            >
              List Your Experience
            </Link>
          </nav>

          <Link
            href="/events"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#17231d] shadow-lg md:hidden"
          >
            Discover
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative flex min-h-[760px] items-end overflow-hidden bg-[#1b2a21]">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=2200&q=90"
            alt="African landscape"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111914] via-black/10 to-black/20" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-40 lg:px-10 lg:pb-28">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-white backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              East Africa, discovered differently
            </div>

            <h1 className="max-w-4xl text-6xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-7xl lg:text-[92px]">
              Discover more.
              <br />
              <span className="text-white/70">Experience more.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
              Find what is happening, where to go and what is worth
              experiencing across East Africa.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/events"
                className="rounded-full bg-white px-7 py-4 text-center text-sm font-black text-[#17231d] shadow-xl transition hover:-translate-y-0.5 hover:bg-[#f4eee3]"
              >
                Explore East Africa →
              </Link>

              <Link
                href="/events?when=tonight"
                className="rounded-full border border-white/30 bg-white/10 px-7 py-4 text-center text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                What's happening tonight
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 hidden text-right text-[10px] font-bold uppercase tracking-[0.25em] text-white/50 lg:block lg:right-10">
          Find your next thing
          <br />
          ↓
        </div>
      </section>

      {/* QUICK DISCOVER */}
      <section className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-5 lg:px-10">
          <span className="mr-2 text-xs font-black uppercase tracking-[0.2em] text-[#687269]">
            Quick discover
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
              className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-semibold transition hover:border-[#17231d] hover:bg-[#17231d] hover:text-white"
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
              Happening now
            </p>

            <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              What&apos;s on tonight?
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-[#687269]">
              Find something worth getting out for tonight.
            </p>
          </div>

          <Link
            href="/events?when=tonight"
            className="font-bold text-[#17231d] underline decoration-black/20 underline-offset-4"
          >
            See everything tonight →
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] bg-[#e8e4db]">
          <div className="grid min-h-[280px] items-center gap-8 p-8 sm:p-12 md:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl">
                ✦
              </div>

              {tonightEvents && tonightEvents.length > 0 ? (
                <>
                  <h3 className="text-2xl font-black">
                    {tonightEvents[0].title}
                  </h3>

                  <p className="mt-3 max-w-xl leading-7 text-[#687269]">
                    {tonightEvents[0].description || "Worth experiencing across East Africa."}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black">
                    Nothing listed for tonight yet.
                  </h3>

                  <p className="mt-3 max-w-xl leading-7 text-[#687269]">
                    Check upcoming events or explore experiences happening across East Africa.
                  </p>
                </>
              )}
            </div>

            <Link
              href="/events"
              className="rounded-full bg-[#17231d] px-6 py-3.5 text-center text-sm font-bold text-white transition hover:opacity-90"
            >
              Explore upcoming →
            </Link>
          </div>
        </div>
      </section>

      {/* EXPLORE CARDS */}
      <section className="bg-[#17231d] py-24 text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-white/40">
                Start exploring
              </p>

              <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Find your next thing.
              </h2>
            </div>

            <Link
              href="/events"
              className="text-sm font-bold text-white/70 transition hover:text-white"
            >
              Explore everything →
            </Link>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-white/10 md:grid-cols-4">
            {[
              ["01", "Tonight", "What's happening right now", "/events?when=tonight"],
              ["02", "Events", "Music, culture and nightlife", "/events?type=events"],
              ["03", "Experiences", "Things worth getting out for", "/events?type=experiences"],
              ["04", "Hidden Gems", "Places most people miss", "/events?type=hidden-gems"],
            ].map(([number, title, text, href]) => (
              <Link
                href={href}
                key={number}
                className="group flex min-h-[250px] flex-col justify-between bg-[#1f3026] p-7 transition hover:bg-[#294031]"
              >
                <div className="text-xs font-black tracking-[0.2em] text-white/35">
                  {number}
                </div>

                <div>
                  <h3 className="text-2xl font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {text}
                  </p>
                </div>

                <div className="text-right text-xl text-white/40 transition group-hover:translate-x-1 group-hover:text-white">
                  →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
              Editor&apos;s pick
            </p>

            <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Worth knowing about.
            </h2>
          </div>

          <span className="text-sm font-semibold text-[#687269]">
            Selected by SafariPlug
          </span>
        </div>

        <Link
          href={featuredEvent ? `/events/${featuredEvent.id}` : "/events"}
          className="group mt-10 grid overflow-hidden rounded-[2rem] bg-[#e8e4db] md:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="min-h-[420px] bg-[#24382b] p-8 sm:p-12">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                  Featured
                </span>

                <span className="text-sm text-white/50">01</span>
              </div>

              <div>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
                  {featuredEvent?.category || "Featured Experience"}
                </p>

                <h3 className="max-w-xl text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                  {featuredEvent?.title || "Friday Night DJ Experience"}
                </h3>

                <p className="mt-5 max-w-lg leading-7 text-white/60">
                  {featuredEvent?.description || "An experience worth discovering across East Africa."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between p-8 sm:p-12">
            <div className="grid gap-7 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a7251]">
                  When
                </p>
                <p className="mt-2 font-bold">{featuredEvent ? new Date(featuredEvent.start_at).toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Coming soon"}</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a7251]">
                  Where
                </p>
                <p className="mt-2 font-bold">{featuredEvent?.venue_name || "East Africa"}</p>
              </div>
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-black/10 pt-6">
              <span className="text-lg font-black">
  {featuredEvent?.price
    ? `${featuredEvent.currency || "KES"} ${featuredEvent.price}`
    : "Free / Check details"}
</span>
              <span className="font-black transition group-hover:translate-x-1">
                Explore →
              </span>
            </div>
          </div>
        </Link>
      </section>

      {/* INTERESTS */}
      <section className="bg-[#e9e4d9] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
            Explore by interest
          </p>

          <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            What are you into?
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {interests.map(([title, description, category], index) => (
              <Link
                key={title}
                href={`/events?category=${category}`}
                className="group rounded-[1.5rem] bg-white p-7 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#a08c70]">
                    0{index + 1}
                  </span>

                  <span className="text-xl text-black/30 transition group-hover:translate-x-1 group-hover:text-black">
                    →
                  </span>
                </div>

                <h3 className="mt-14 text-2xl font-black">{title}</h3>

                <p className="mt-2 max-w-xs text-sm leading-6 text-[#687269]">
                  {description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#8a7251]">
              Explore by destination
            </p>

            <h2 className="text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Where are you going?
            </h2>

            <p className="mt-4 max-w-xl leading-7 text-[#687269]">
              Choose a destination and see what is happening there.
            </p>
          </div>

          <Link
            href="/events"
            className="font-bold underline decoration-black/20 underline-offset-4"
          >
            View all destinations →
          </Link>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {locations.map(([name, description, query], index) => (
            <Link
              href={`/events?${query}`}
              key={name}
              className="group min-h-[190px] rounded-[1.5rem] border border-black/10 bg-white p-6 transition hover:-translate-y-1 hover:bg-[#17231d] hover:text-white"
            >
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                  0{index + 1}
                </span>

                <span className="transition group-hover:translate-x-1">
                  →
                </span>
              </div>

              <div className="mt-16">
                <h3 className="text-2xl font-black">{name}</h3>
                <p className="mt-1 text-sm opacity-55">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* INTELLIGENCE */}
      <section className="bg-[#c8bca5] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-[#5c584f]">
                SafariPlug Intelligence
              </p>

              <h2 className="text-4xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl">
                The internet is noisy.
                <br />
                <span className="opacity-55">We find what&apos;s worth doing.</span>
              </h2>
            </div>

            <div>
              <p className="max-w-2xl text-lg leading-8 text-[#4d514a]">
                SafariPlug Intelligence continuously discovers events,
                experiences and emerging places across East Africa, helping
                surface the things that are easy to miss.
              </p>

              <Link
                href="/events"
                className="mt-8 inline-flex rounded-full bg-[#17231d] px-7 py-4 text-sm font-bold text-white transition hover:opacity-90"
              >
                Explore the discoveries →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS CTA */}
      <section className="bg-[#17231d] py-24 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center lg:px-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
            For businesses, hosts and creators
          </p>

          <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-6xl">
            Have something worth discovering?
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
            Put your event, restaurant, hotel, tour, beach club or experience
            in front of people looking for their next thing to do.
          </p>

          <Link
            href="/submit"
            className="mt-9 inline-flex rounded-full bg-white px-8 py-4 text-sm font-black text-[#17231d] transition hover:bg-[#f4eee3]"
          >
            List Your Experience →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#101812] px-6 py-14 text-white lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-black text-[#17231d]">
                  S
                </span>

                <span className="text-xl font-black">SafariPlug</span>
              </div>

              <p className="mt-5 max-w-md text-sm leading-6 text-white/45">
                Discover the places, people and experiences making East Africa
                worth exploring.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-white/60">
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <Link href="/events" className="hover:text-white">
                Discover
              </Link>
              <Link href="/submit" className="hover:text-white">
                Submit
              </Link>
              <Link href="/admin/login" className="hover:text-white">
                Admin
              </Link>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/30">
            © 2026 SafariPlug. Discover more. Experience more.
          </div>
        </div>
      </footer>
    </main>
  );
}



