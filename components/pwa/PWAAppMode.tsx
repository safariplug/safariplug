"use client";

import { useEffect } from "react";

function detectStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PWAAppMode() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(display-mode: standalone)");

    const sync = () => {
      root.dataset.appMode = detectStandalone() ? "standalone" : "browser";
    };

    sync();
    media.addEventListener?.("change", sync);
    window.addEventListener("appinstalled", sync);

    return () => {
      media.removeEventListener?.("change", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  return null;
}
