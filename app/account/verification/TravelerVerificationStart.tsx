"use client";

import { useState } from "react";

declare global {
  interface Window {
    snsWebSdk?: {
      init: (accessToken: string, refresh: () => Promise<string>) => {
        withConf: (config: Record<string, unknown>) => any;
        withOptions: (options: Record<string, unknown>) => any;
        on: (event: string, callback: (payload: unknown) => void) => any;
        onMessage: (callback: (type: string, payload: unknown) => void) => any;
        build: () => { launch: (selector: string) => void };
      };
    };
  }
}

async function loadSdk() {
  if (window.snsWebSdk) return window.snsWebSdk;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://static.sumsub.com/idensic/static/sns-websdk-builder.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load the verification provider."));
    document.head.appendChild(script);
  });
  return window.snsWebSdk;
}

export default function TravelerVerificationStart({
  hasCase,
  status,
}: {
  hasCase: boolean;
  status: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      if (!hasCase) {
        const started = await fetch("/api/account/verification", { method: "POST" });
        const body = await started.json().catch(() => ({}));
        if (!started.ok) throw new Error(body.error || "Unable to start verification.");
      }

      const response = await fetch("/api/account/verification/session", {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to prepare verification.");

      const sdk = await loadSdk();
      if (!sdk) throw new Error("Verification provider SDK is unavailable.");

      setOpen(true);
      window.setTimeout(() => {
        const instance = sdk
          .init(body.accessToken, async () => {
            const refresh = await fetch("/api/account/verification/session", {
              method: "POST",
            });
            const refreshed = await refresh.json().catch(() => ({}));
            if (!refresh.ok || typeof refreshed.accessToken !== "string") {
              throw new Error("Unable to refresh verification session.");
            }
            return refreshed.accessToken;
          })
          .withConf({ lang: "en", theme: "light" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onError", (error: unknown) =>
            setMessage(
              typeof error === "string"
                ? error
                : "Verification session reported an error."
            )
          )
          .onMessage((type: string, payload: unknown) => {
            void payload;
            if (type === "idCheck.onStepCompleted") {
              setMessage(
                "Verification step completed. Continue until identity and the live face check are finished."
              );
            }
            if (type === "idCheck.onApplicantStatusChanged") {
              setMessage(
                "Verification status updated. SafariPlug receives the final result securely from the verification provider."
              );
            }
          })
          .build();
        instance.launch("#traveler-sumsub-websdk-container");
      }, 50);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to start verification."
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
        Your traveler identity and live face verification is approved. Trust-sensitive bookings can use this verification while it remains valid.
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          disabled={busy || status === "in_review"}
          onClick={() => void start()}
          className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-35"
        >
          {busy
            ? "Preparing…"
            : status === "in_review"
              ? "Verification in progress"
              : "Start secure verification"}
        </button>
        {message && !open ? (
          <p className="max-w-xl text-xs leading-5 text-black/50">{message}</p>
        ) : null}
      </div>

      {open ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Secure traveler verification</p>
              <p className="mt-1 text-xs text-black/45">
                Complete every requested step, including the live face/liveness check.
              </p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                window.location.reload();
              }}
              className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold"
            >
              Close
            </button>
          </div>
          <div id="traveler-sumsub-websdk-container" className="min-h-[620px] w-full" />
          {message ? (
            <p className="border-t border-black/8 px-5 py-3 text-xs text-black/50">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
