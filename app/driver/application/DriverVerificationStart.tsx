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
    script.onerror = () =>
      reject(new Error("Unable to load the identity verification provider."));
    document.head.appendChild(script);
  });
  return window.snsWebSdk;
}

export default function DriverVerificationStart({
  status,
}: {
  status: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/driver/verification/session", {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Unable to prepare driver verification.");
      }

      const sdk = await loadSdk();
      if (!sdk) throw new Error("Verification provider SDK is unavailable.");

      setOpen(true);
      window.setTimeout(() => {
        const instance = sdk
          .init(body.accessToken, async () => {
            const refresh = await fetch("/api/driver/verification/session", {
              method: "POST",
            });
            const refreshed = await refresh.json().catch(() => ({}));
            if (!refresh.ok || typeof refreshed.accessToken !== "string") {
              throw new Error("Unable to refresh driver verification session.");
            }
            return refreshed.accessToken;
          })
          .withConf({ lang: "en", theme: "dark" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onError", (error: unknown) =>
            setMessage(
              typeof error === "string"
                ? error
                : "Verification provider reported an error."
            )
          )
          .onMessage((type: string) => {
            if (type === "idCheck.onStepCompleted") {
              setMessage(
                "Verification step completed. Continue until identity and the live face/liveness check are finished."
              );
            }
            if (type === "idCheck.onApplicantStatusChanged") {
              setMessage(
                "Verification status changed. SafariPlug receives the final decision securely from the provider."
              );
            }
          })
          .build();
        instance.launch("#driver-sumsub-websdk-container");
      }, 50);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to start driver verification."
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    return (
      <div className="mt-5 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm text-emerald-300">
        Identity + live face/liveness verification is approved. Driver activation still depends on the remaining document, vehicle and profile-photo compliance gates.
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="rounded-xl bg-[#c9a86a] px-5 py-3 text-sm font-black text-black disabled:opacity-40"
        >
          {busy ? "Preparing secure check…" : "Complete live identity verification"}
        </button>
        {message && !open ? (
          <p className="max-w-xl text-xs leading-5 text-zinc-500">{message}</p>
        ) : null}
      </div>

      {open ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
            <div>
              <p className="font-semibold text-white">Secure driver verification</p>
              <p className="mt-1 text-xs text-zinc-500">
                Complete all requested identity and live face/liveness steps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.location.reload();
              }}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"
            >
              Close
            </button>
          </div>
          <div id="driver-sumsub-websdk-container" className="min-h-[620px] w-full bg-white" />
          {message ? (
            <p className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-500">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
