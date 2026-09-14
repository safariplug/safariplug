"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

export function PWAPremiumFeedback() {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState(false);
  const [online, setOnline] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const fallbackTimer = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncMode = () => setStandalone(detectStandalone());
    const syncOnline = () => setOnline(navigator.onLine);

    syncMode();
    syncOnline();

    media.addEventListener?.("change", syncMode);
    window.addEventListener("appinstalled", syncMode);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    return () => {
      media.removeEventListener?.("change", syncMode);
      window.removeEventListener("appinstalled", syncMode);
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  useEffect(() => {
    setNavigating(false);
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    if (!standalone || isBlocked(pathname)) return;

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}`;
      const next = `${destination.pathname}${destination.search}`;
      if (current === next) return;

      setNavigating(true);
      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = window.setTimeout(() => {
        setNavigating(false);
        fallbackTimer.current = null;
      }, 2500);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, standalone]);

  useEffect(() => {
    return () => {
      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
    };
  }, []);

  if (!standalone || isBlocked(pathname)) return null;

  return (
    <>
      {navigating ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-white/10"
          aria-hidden="true"
        >
          <div className="safariplug-route-progress h-full w-1/3 bg-[#e7c98d]" />
        </div>
      ) : null}

      {!online ? (
        <aside
          className="fixed left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full border border-amber-300/20 bg-zinc-950/95 px-4 py-2 text-xs font-semibold text-amber-100 shadow-xl backdrop-blur"
          style={{ marginTop: "env(safe-area-inset-top)" }}
          role="status"
        >
          Offline · fresh availability and bookings need a connection
        </aside>
      ) : null}
    </>
  );
}
