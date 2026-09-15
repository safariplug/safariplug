import Link from "next/link";
import DiscoverySwitcher from "@/components/DiscoverySwitcher";

export const metadata = { title: "Drivers & Transfers Across Africa | SafariPlug", description: "Find trusted transport options with SafariPlug. Request airport transfers, local rides, event transport, safari transfers, and specific-driver support through SafariPlug Concierge." };

const useCases = [
  ["Airport transfers", "Plan pickup or drop-off around your flight and accommodation."],
  ["Event transport", "Arrange a driver for concerts, nightlife, dinners, weddings, and private events."],
  ["Safari transfers", "Coordinate transport between cities, lodges, parks, hotels, and experiences."],
  ["Specific-driver requests", "Ask SafariPlug to help request a particular driver when that option is available."],
];

export default function DriversPage() {
  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="bg-[#070708] text-[#f4f0e8]"><div className="mx-auto max-w-7xl px-5 pb-14 pt-10 md:px-8 md:pb-20 md:pt-16"><p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug Drivers & Transfers</p><h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight text-white md:text-7xl">Get where you need to go, without piecing the trip together yourself.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">Tell SafariPlug where you need to go. Live open driver inventory is not shown yet, so transport requests go through Concierge using your real trip details.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/concierge" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708]">Request transport →</Link><Link href="/become-a-driver" className="rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white/80">Become a SafariPlug driver</Link></div></div></section>
    <DiscoverySwitcher current="/drivers" />
    <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-black/35">What do you need?</p><h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Start with the trip, not the transport jargon.</h2></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{useCases.map(([title, description]) => <Link key={title} href={`/concierge?q=${encodeURIComponent(title)}`} className="group rounded-[1.6rem] border border-black/8 bg-white p-7 shadow-[0_18px_60px_-50px_rgba(0,0,0,.5)] transition hover:-translate-y-1 hover:border-[#c9a86a]/55"><div className="flex items-start justify-between gap-4"><h3 className="font-serif text-3xl font-medium">{title}</h3><span className="text-xl text-[#9d793e] transition group-hover:translate-x-1">→</span></div><p className="mt-3 text-sm leading-6 text-black/55">{description}</p><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#8b672f]">Start request</p></Link>)}</div><div className="mt-10 rounded-[1.8rem] border border-[#c9a86a]/25 bg-[#f1eadc] p-7 md:p-9"><p className="text-xs font-black uppercase tracking-[0.24em] text-[#8b672f]">Safety direction</p><h2 className="mt-3 font-serif text-3xl font-medium md:text-4xl">Trusted people, clearer identity, safer requests.</h2><p className="mt-4 max-w-3xl leading-7 text-black/60">SafariPlug is designed around verified driver identity, visible driver profiles, and governed request flows. Features are introduced only when the underlying verification and operational controls are ready.</p></div></section>
  </main>;
}
