"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/admin", "/partner", "/supplier", "/business", "/driver"];

export default function PublicFooter() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) return null;

  return (
    <footer className="border-t border-white/10 bg-[#080808] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.35fr_1fr_1fr] md:px-10">
        <div>
          <Link href="/" className="inline-flex items-center" aria-label="SafariPlug home">
            <img src="/brand/safariplug-wordmark-light.png" alt="SafariPlug" className="h-7 w-auto" />
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
            One starting point for stays, experiences, transfers, services, food, events and trips across Africa.
          </p>
          <div className="mt-5 space-y-1 text-sm text-white/55">
            <p>Nairobi, Kenya</p>
            <p>P.O. Box 284-00515, Nairobi, Kenya</p>
            <a href="mailto:info@safariplug.com" className="inline-block font-medium text-[#e7c98d] hover:text-white">info@safariplug.com</a>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/35">Explore</p>
          <div className="mt-4 grid gap-2 text-sm text-white/60">
            <Link href="/experiences" className="hover:text-white">Experiences</Link>
            <Link href="/hotels" className="hover:text-white">Hotels</Link>
            <Link href="/transfers" className="hover:text-white">Transfers</Link>
            <Link href="/services" className="hover:text-white">Services</Link>
            <Link href="/restaurants" className="hover:text-white">Food & restaurants</Link>
            <Link href="/events" className="hover:text-white">Events</Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/35">SafariPlug</p>
          <div className="mt-4 grid gap-2 text-sm text-white/60">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/partners" className="hover:text-white">List your business</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs text-white/35">
        © {new Date().getFullYear()} SafariPlug. Availability, pricing and supplier status are shown only when supported by current source data.
      </div>
    </footer>
  );
}
