"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/events", label: "Discover", icon: DiscoverIcon },
  { href: "/account/trips", label: "Trips", icon: TripsIcon },
  { href: "/account/saved", label: "Saved", icon: SavedIcon },
  { href: "/account", label: "Profile", icon: ProfileIcon },
];

const BLOCKED_PREFIXES = [
  "/admin",
  "/auth",
  "/api",
  "/business",
  "/driver",
  "/become-a-driver",
  "/become-a-service-provider",
];

function detectStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isBlocked(pathname: string) {
  return BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/events") {
    return pathname === "/events" || pathname.startsWith("/events/");
  }
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PWAStandaloneNav() {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const sync = () => setStandalone(detectStandalone());

    sync();
    media.addEventListener?.("change", sync);
    window.addEventListener("appinstalled", sync);

    return () => {
      media.removeEventListener?.("change", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  const visible = standalone && !isBlocked(pathname);

  useEffect(() => {
    document.body.classList.toggle("has-pwa-standalone-nav", visible);
    return () => document.body.classList.remove("has-pwa-standalone-nav");
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-black/95 px-2 pt-2 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="SafariPlug app navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold transition active:scale-95 ${
                active ? "text-[#e7c98d]" : "text-white/50 hover:text-white"
              }`}
            >
              <Icon active={active} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function IconShell({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className={`flex h-7 w-10 items-center justify-center rounded-full transition ${
        active ? "bg-[#c9a86a]/15" : "bg-transparent"
      }`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 10.8 12 3.8l8.5 7v8.4a1 1 0 0 1-1 1h-5v-5.8h-5v5.8h-5a1 1 0 0 1-1-1Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconShell>
  );
}

function DiscoverIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.7" />
        <path d="m15.2 8.8-2 4.4-4.4 2 2-4.4Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconShell>
  );
}

function TripsIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8.2 6.5V5.2A2.2 2.2 0 0 1 10.4 3h3.2a2.2 2.2 0 0 1 2.2 2.2v1.3" strokeLinecap="round" />
        <rect x="4" y="6.5" width="16" height="13.5" rx="2.2" />
        <path d="M4 11.3h16M9 11.3v2.2h6v-2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconShell>
  );
}

function SavedIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20.2 4.9 13.4A5.2 5.2 0 0 1 12 5.8a5.2 5.2 0 0 1 7.1 7.6Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IconShell>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.3" />
        <path d="M5.4 20a6.6 6.6 0 0 1 13.2 0" strokeLinecap="round" />
      </svg>
    </IconShell>
  );
}
