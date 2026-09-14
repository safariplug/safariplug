"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "safariplug:pwa-install-dismissed-at";
const DISMISS_DAYS = 14;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function dismissalIsActive() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(false);

  const excluded = useMemo(
    () =>
      pathname.startsWith("/admin") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api"),
    [pathname],
  );

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone);
    if (excluded || standalone) return;

    const activeDismissal = dismissalIsActive();
    setDismissed(activeDismissal);
    if (!activeDismissal && isIOS()) setShowIOSHelp(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (!dismissalIsActive()) setDismissed(false);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      setShowIOSHelp(false);
      setDismissed(true);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [excluded]);

  if (excluded || dismissed || installed || (!installEvent && !showIOSHelp)) {
    return null;
  }

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Storage may be unavailable in private browsing; dismissal still applies this session.
    }
    setDismissed(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
      setDismissed(true);
    }
  }

  return (
    <aside
      aria-label="Install SafariPlug"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Add SafariPlug to your phone</p>
          <p className="mt-1 text-xs leading-5 text-zinc-300">
            {showIOSHelp && !installEvent
              ? "In Safari, tap Share, then choose Add to Home Screen."
              : "Install the app for a faster, full-screen SafariPlug experience."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss install suggestion"
        >
          Not now
        </button>
      </div>

      {installEvent ? (
        <button
          type="button"
          onClick={install}
          className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          Install SafariPlug
        </button>
      ) : null}
    </aside>
  );
}
