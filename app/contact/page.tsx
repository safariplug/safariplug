import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact SafariPlug",
  description: "Contact SafariPlug for traveler support, supplier partnerships and general enquiries.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-amber-400">Contact</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-7xl">Talk to SafariPlug.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">Questions about a trip, booking, supplier partnership or your SafariPlug account? Use the appropriate route below.</p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[.04] p-7">
            <p className="text-xs uppercase tracking-[.18em] text-white/35">General & traveler support</p>
            <a href="mailto:info@safariplug.com" className="mt-3 block text-2xl font-semibold text-amber-300">info@safariplug.com</a>
            <p className="mt-4 text-sm leading-6 text-white/55">Include your booking or trip reference when your question relates to an existing reservation.</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[.04] p-7">
            <p className="text-xs uppercase tracking-[.18em] text-white/35">Business & supplier partnerships</p>
            <Link href="/partners" className="mt-3 block text-2xl font-semibold text-amber-300">Partner with SafariPlug →</Link>
            <p className="mt-4 text-sm leading-6 text-white/55">Hotels, restaurants, drivers, tour operators, event organizers and local service businesses can start from the partner workspace.</p>
          </article>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-7">
          <p className="text-xs uppercase tracking-[.18em] text-white/35">Correspondence</p>
          <p className="mt-3 text-lg font-medium">SafariPlug · Nairobi, Kenya</p>
          <p className="mt-2 text-sm text-white/55">P.O. Box 284-00515, Nairobi, Kenya</p>
          <p className="mt-6 text-xs leading-5 text-white/35">For urgent issues involving an active third-party booking, also use the supplier support channel shown in your confirmation where applicable.</p>
        </section>
      </section>
    </main>
  );
}
