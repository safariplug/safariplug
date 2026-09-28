import Link from "next/link";
import ViatorBasicClient from "./ViatorBasicClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Viator Experiences | SafariPlug",
  description: "Browse Viator experiences through SafariPlug. Viator products are displayed and transacted in a Viator-supported currency.",
};

export default function ViatorActivitiesPage() {
  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
      <section className="bg-[#070708] text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#c9a86a]">SafariPlug × Viator</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-medium tracking-tight md:text-7xl">
            Global experiences inside your SafariPlug journey.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/55">
            Viator experiences use Viator-supported pricing and payment rules. SafariPlug will not convert or present Viator selling prices in KES.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#viator-basic" className="rounded-full bg-[#e7c98d] px-6 py-3.5 text-sm font-black text-[#070708]">Open Viator sandbox tools →</a>
            <Link href="/activities" className="rounded-full border border-white/15 px-6 py-3.5 text-sm font-bold text-white/80">SafariPlug activities</Link>
          </div>
        </div>
      </section>
      <section id="viator-basic" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <ViatorBasicClient />
      </section>
    </main>
  );
}
