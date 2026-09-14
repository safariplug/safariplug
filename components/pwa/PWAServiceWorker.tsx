"use client";

import { useEffect, useState } from "react";

export function PWAServiceWorker() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdate = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void registration?.update().catch(() => undefined);
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        if (registration.waiting) setWaitingWorker(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration?.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(worker);
            }
          });
        });
      } catch (error) {
        console.error("SafariPlug service worker registration failed", error);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  function applyUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waitingWorker) return null;

  return (
    <aside className="fixed inset-x-3 bottom-24 z-[80] mx-auto max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur md:bottom-6">
      <p className="text-sm font-semibold text-white">SafariPlug update ready</p>
      <p className="mt-1 text-xs leading-5 text-zinc-300">
        A newer version is available. Update when you are ready.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setWaitingWorker(null)}
          className="flex-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Later
        </button>
        <button
          type="button"
          onClick={applyUpdate}
          className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
        >
          Update now
        </button>
      </div>
    </aside>
  );
}
