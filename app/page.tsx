import { supabase } from "@/lib/supabase";

const quickLinks = [
  { label: "Tonight", icon: "🌙" },
  { label: "This Weekend", icon: "🔥" },
  { label: "Events", icon: "🎉" },
  { label: "Experiences", icon: "🌴" },
  { label: "Deals", icon: "🏷️" },
  { label: "Places", icon: "📍" },
];

const cities = [
  { name: "Nairobi", country: "Kenya", emoji: "🇰🇪" },
  { name: "Mombasa", country: "Kenya", emoji: "🇰🇪" },
  { name: "Diani", country: "Kenya", emoji: "🇰🇪" },
  { name: "Malindi", country: "Kenya", emoji: "🇰🇪" },
  { name: "Zanzibar", country: "Tanzania", emoji: "🇹🇿" },
  { name: "Kampala", country: "Uganda", emoji: "🇺🇬" },
  { name: "Kigali", country: "Rwanda", emoji: "🇷🇼" },
];

export default async function Home() {
  const { data: city } = await supabase
    .from("cities")
    .select("name, country")
    .eq("slug", "nairobi")
    .single();

  return (
    <main className="min-h-screen bg-white text-slate-900">

      {/* NAVIGATION */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-2xl font-black tracking-tight">
              Safari<span className="text-orange-500">Plug</span>
            </div>
            <div className="text-xs font-medium text-slate-500">
              Discover more. Experience more.
            </div>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#discover" className="text-sm font-medium hover:text-orange-500">
              Discover
            </a>
            <a href="#experiences" className="text-sm font-medium hover:text-orange-500">
              Experiences
            </a>
            <a href="#business" className="text-sm font-medium hover:text-orange-500">
              For Businesses
            </a>
          </div>

          <button className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold hover:border-orange-500 hover:text-orange-500">
            List Your Business
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">

            <div className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white">
              📍 Discover what's happening in East Africa
            </div>

            <h1 className="text-5xl font-black leading-tight tracking-tight text-white md:text-7xl">
              Your city.
              <br />
              <span className="text-orange-400">Your experience.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Find events, nightlife, experiences, restaurants, activities
              and the best things happening around you.
            </p>

            {/* SEARCH */}
            <div className="mt-10 flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-3 shadow-2xl md:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-4">
                <span className="text-xl">📍</span>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your city
                  </div>
                  <div className="font-semibold">
                    {city?.name || "Choose a city"}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-4">
                <span className="text-xl">🔎</span>
                <div className="font-medium text-slate-500">
                  What are you looking for?
                </div>
              </div>

              <button className="rounded-xl bg-orange-500 px-8 py-4 font-bold text-white hover:bg-orange-600">
                Explore
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6">
          <div className="flex min-w-max gap-3 py-5">
            {quickLinks.map((item) => (
              <button
                key={item.label}
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold hover:border-orange-400 hover:bg-orange-50"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* DISCOVER */}
      <section id="discover" className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-bold uppercase tracking-widest text-orange-500">
              Discover
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">
              What's happening
            </h2>
            <p className="mt-3 text-slate-500">
              Explore events and activities happening around East Africa.
            </p>
          </div>

          <button className="font-semibold text-orange-500">
            View everything →
          </button>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">

          <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex h-56 items-center justify-center bg-slate-200 text-6xl transition group-hover:scale-105">
              🎵
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-orange-500">
                MUSIC & NIGHTLIFE
              </p>
              <h3 className="mt-2 text-xl font-bold">
                Find what's happening tonight
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Concerts, club nights, DJs, parties and live entertainment.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex h-56 items-center justify-center bg-slate-200 text-6xl transition group-hover:scale-105">
              🌴
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-orange-500">
                EXPERIENCES
              </p>
              <h3 className="mt-2 text-xl font-bold">
                Do something unforgettable
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Adventures, food, wellness, water activities, safaris and more.
              </p>
            </div>
          </div>

          <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex h-56 items-center justify-center bg-slate-200 text-6xl transition group-hover:scale-105">
              🏷️
            </div>
            <div className="p-6">
              <p className="text-sm font-bold text-orange-500">
                DEALS & PROMOS
              </p>
              <h3 className="mt-2 text-xl font-bold">
                Find something worth sharing
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Discover special offers from restaurants, hotels and experiences.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* EXPERIENCES */}
      <section id="experiences" className="bg-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-20">

          <p className="font-bold uppercase tracking-widest text-orange-500">
            Experiences
          </p>

          <h2 className="mt-2 text-4xl font-black tracking-tight">
            Make your trip more interesting
          </h2>

          <p className="mt-4 max-w-2xl text-slate-500">
            SafariPlug isn't just about events. Discover things you can
            actually do, taste, explore and experience.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["🦒", "Safari & Wildlife"],
              ["🌊", "Water Activities"],
              ["🍽️", "Food & Drink"],
              ["🧘", "Wellness"],
              ["🧗", "Adventure"],
              ["❤️", "Romantic"],
              ["👨‍👩‍👧", "Family"],
              ["🎨", "Culture"],
            ].map(([icon, label]) => (
              <div
                key={label}
                className="rounded-2xl bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-3xl">{icon}</div>
                <div className="mt-4 font-bold">{label}</div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CITIES */}
      <section className="mx-auto max-w-7xl px-6 py-20">

        <p className="font-bold uppercase tracking-widest text-orange-500">
          Explore East Africa
        </p>

        <h2 className="mt-2 text-4xl font-black tracking-tight">
          Choose your city
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {cities.map((item) => (
            <button
              key={item.name}
              className="rounded-2xl border border-slate-200 p-6 text-left hover:border-orange-400 hover:bg-orange-50"
            >
              <div className="text-3xl">{item.emoji}</div>
              <div className="mt-4 text-lg font-bold">{item.name}</div>
              <div className="text-sm text-slate-500">{item.country}</div>
            </button>
          ))}
        </div>

      </section>

      {/* BUSINESS CTA */}
      <section id="business" className="bg-orange-500">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex flex-col justify-between gap-10 md:flex-row md:items-center">

            <div className="max-w-2xl">
              <p className="font-bold uppercase tracking-widest text-orange-100">
                For businesses
              </p>

              <h2 className="mt-3 text-4xl font-black text-white md:text-5xl">
                Have something happening?
              </h2>

              <p className="mt-5 text-lg leading-8 text-orange-50">
                Put your event, experience, promotion or business in front
                of people looking for something to do.
              </p>
            </div>

            <button className="rounded-full bg-white px-8 py-4 font-bold text-orange-600 shadow-lg hover:bg-orange-50">
              Promote Your Business
            </button>

          </div>
        </div>
      </section>

      {/* AI ITINERARY */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">

          <div className="mx-auto max-w-3xl">

            <div className="text-5xl">✨</div>

            <p className="mt-6 font-bold uppercase tracking-widest text-orange-400">
              Coming soon
            </p>

            <h2 className="mt-3 text-4xl font-black text-white md:text-5xl">
              Let AI plan your perfect day
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-400">
              Tell SafariPlug what you like, your budget and how much time
              you have. We'll build an itinerary around the best things
              happening in your city.
            </p>

            <button className="mt-8 rounded-full bg-orange-500 px-8 py-4 font-bold text-white hover:bg-orange-600">
              Build My Itinerary
            </button>

          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 md:flex-row">

          <div>
            <div className="text-xl font-black">
              Safari<span className="text-orange-500">Plug</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Discover more. Experience more.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            © 2026 SafariPlug. Discover East Africa.
          </div>

        </div>
      </footer>

    </main>
  );
}