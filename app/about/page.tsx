import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About SafariPlug",
  description: "Learn how SafariPlug helps travelers discover and book trusted trip components across Africa.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-10 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-amber-400">About SafariPlug</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">One place to put the whole trip together.</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-white/60">
          SafariPlug is a travel discovery and booking platform built around the real journey: where to stay, what to do, how to move, where to eat, useful local services, events and the trip that connects them.
        </p>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            ["Real inventory first", "SafariPlug does not invent availability, prices, suppliers or booking confirmations. Where live inventory is not available, we say so and offer a clear next step."],
            ["Africa-focused", "We are building for travel across Africa, starting with the destinations and supplier networks where we can operate responsibly and verify supply."],
            ["One trip, not isolated bookings", "Trips, transfers, stays, experiences and local services are designed to work together instead of forcing travelers into separate planning silos."],
          ].map(([title, body]) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-white/55">{body}</p></article>)}
        </div>

        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[.04] p-7 md:p-10">
          <h2 className="text-2xl font-semibold">How SafariPlug works</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            SafariPlug combines direct supplier inventory with connected travel providers. Some bookings are completed directly through SafariPlug; others use a clearly identified connected supplier or external checkout. Payment currency and booking terms are shown before you commit.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/contact" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-black">Contact SafariPlug</Link>
            <Link href="/partners" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold">Become a partner</Link>
          </div>
        </section>
      </section>
    </main>
  );
}
