import Link from "next/link";

export const metadata = {
  title: "Drivers & Transfers Across Africa | SafariPlug",
  description: "Find trusted transport options with SafariPlug. Request airport transfers, local rides, event transport, safari transfers, and specific-driver support through SafariPlug Concierge.",
};

const useCases = [
  ["Airport transfers", "Plan pickup or drop-off around your flight and accommodation."],
  ["Event transport", "Arrange a driver for concerts, nightlife, dinners, weddings, and private events."],
  ["Safari transfers", "Coordinate transport between cities, lodges, parks, hotels, and experiences."],
  ["Specific-driver requests", "Ask SafariPlug to help request a particular driver when that option is available."],
];

export default function DriversPage() {
  return (
    <main className="min-h-screen bg-[#070708] text-[#f4f0e8]">
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug Drivers & Transfers</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight text-white md:text-7xl">
          Get where you need to go, without piecing the trip together yourself.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
          SafariPlug is building trusted driver and transfer connectivity across Africa. Live open driver inventory is not shown yet; use SafariPlug Concierge to request transport based on your real trip details.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/concierge" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708] hover:bg-[#f0d9a4]">
            Request transport →
          </Link>
          <Link href="/become-a-driver" className="rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white/80 hover:border-[#c9a86a]/60 hover:text-[#e7c98d]">
            Become a SafariPlug driver
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {useCases.map(([title, description]) => (
            <div key={title} className="rounded-[1.6rem] border border-white/10 bg-[#111114] p-7">
              <h2 className="font-serif text-3xl font-medium text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[1.8rem] border border-[#c9a86a]/25 bg-[#c9a86a]/5 p-7 md:p-9">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e7c98d]">Safety direction</p>
          <h2 className="mt-3 font-serif text-3xl font-medium text-white md:text-4xl">Trusted people, clearer identity, safer requests.</h2>
          <p className="mt-4 max-w-3xl leading-7 text-white/60">
            SafariPlug is designed around verified driver identity, visible driver profiles, and governed request flows. Features are introduced only when the underlying verification and operational controls are ready.
          </p>
        </div>
      </section>
    </main>
  );
}
