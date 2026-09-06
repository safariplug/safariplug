"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/events", label: "Discover" },
  { href: "/concierge", label: "AI Concierge" },
  { href: "/account/trips", label: "My Trips" },
];

export default function TravelerNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/" className="shrink-0">
          <img src="/brand/safariplug-wordmark-light.png" alt="SafariPlug" className="h-7 w-auto" />
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== "/events" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${active ? "bg-[#c9a86a]/15 text-[#e7c98d]" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
