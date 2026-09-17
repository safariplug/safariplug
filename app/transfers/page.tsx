import Link from "next/link";
import TransferSearchClient from "./TransferSearchClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Transfers Across Africa | SafariPlug",
  description:
    "Search connected transfer inventory or choose a verified SafariPlug driver for airport, hotel and point-to-point transport.",
};

export default function TransfersPage() {
  const routeCatalogueEnabled =
    process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_CACHE_ENABLED?.trim().toLowerCase() === "true";

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#070708] text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">
            SafariPlug Transfers
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight md:text-7xl">
            Airport, hotel and point-to-point transfers.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
            Search connected supplier inventory when available, or choose an eligible verified SafariPlug driver.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#supplier-search" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708]">
              Search transfers →
            </a>
            <Link href="/drivers" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-bold text-white/80">
              Browse verified drivers
            </Link>
          </div>
        </div>
      </section>

      <section id="supplier-search" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <TransferSearchClient routeCatalogueEnabled={routeCatalogueEnabled} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/drivers" className="rounded-[1.75rem] border border-black/8 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">SafariPlug marketplace</p>
            <h2 className="mt-2 text-2xl font-semibold">Choose a verified driver</h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Browse active, identity-verified drivers with eligible vehicles and published transfer rates.
            </p>
            <span className="mt-5 inline-flex text-sm font-bold text-[#9d793e]">Browse drivers →</span>
          </Link>
          <Link href="/concierge?q=I need a transfer" className="rounded-[1.75rem] border border-black/8 bg-white p-6">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-black/35">Concierge</p>
            <h2 className="mt-2 text-2xl font-semibold">Need help planning the route?</h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Tell SafariPlug where you are going and we can route you toward the right transport option.
            </p>
            <span className="mt-5 inline-flex text-sm font-bold text-[#9d793e]">Ask Concierge →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
