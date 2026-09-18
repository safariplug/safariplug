"use client";

import { useEffect, useState } from "react";

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

export default function SpecialistVerificationStart({
  claimToken,
  initialStatus,
}: {
  claimToken?: string | null;
  initialStatus: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [claimBusy, setClaimBusy] = useState(Boolean(claimToken));
  const [claimed, setClaimed] = useState(!claimToken);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!claimToken) return;
    let cancelled = false;
    async function claim() {
      setClaimBusy(true);
      setMessage("");
      try {
        const response = await fetch("/api/services/provider-verification/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept_claim", token: claimToken }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!response.ok) throw new Error(body?.error || "Unable to claim specialist profile.");
        if (!cancelled) {
          setClaimed(true);
          setStatus(body?.staff?.verification_state || "unverified");
          setMessage("Specialist profile linked to your SafariPlug account. You can now complete identity verification.");
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Unable to claim specialist profile.");
      } finally {
        if (!cancelled) setClaimBusy(false);
      }
    }
    void claim();
    return () => { cancelled = true; };
  }, [claimToken]);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/services/provider-verification/session", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      if (!response.ok) throw new Error(body?.error || "Unable to prepare specialist verification.");

      const sdk = await loadSdk();
      if (!sdk) throw new Error("Verification provider SDK is unavailable.");

      setOpen(true);
      window.setTimeout(() => {
        sdk
          .init(body.accessToken, async () => {
            const refresh = await fetch("/api/services/provider-verification/session", { method: "POST" });
            const refreshed = await refresh.json().catch(() => ({}));
            if (!refresh.ok || typeof refreshed.accessToken !== "string") {
              throw new Error("Unable to refresh specialist verification session.");
            }
            return refreshed.accessToken;
          })
          .withConf({ lang: "en", theme: "light" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onError", (error: unknown) =>
            setMessage(typeof error === "string" ? error : "Verification provider reported an error.")
          )
          .onMessage((type: string) => {
            if (type === "idCheck.onStepCompleted") {
              setMessage("Step completed. Continue until identity and live face/liveness checks are finished.");
            }
            if (type === "idCheck.onApplicantStatusChanged") {
              setMessage("Verification status changed. SafariPlug receives the final result securely from the provider.");
            }
          })
          .build()
          .launch("#specialist-sumsub-websdk-container");
      }, 50);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start specialist verification.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "verified") {
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
        Your identity + live face/liveness verification is approved. Your business can make you bookable once the remaining service and availability requirements are satisfied.
      </div>
    );
  }

  return (
    <>
      {claimBusy ? (
        <p className="mt-6 rounded-2xl bg-white p-4 text-sm text-black/55">Linking this specialist profile to your SafariPlug account…</p>
      ) : null}

      {!claimBusy && claimed ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="mt-6 rounded-full bg-black px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Preparing secure check…" : "Start identity + live face verification"}
        </button>
      ) : null}

      {message && !open ? <p className="mt-3 text-sm leading-6 text-black/55">{message}</p> : null}

      {open ? (
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Secure specialist verification</p>
              <p className="mt-1 text-xs text-black/45">Complete all requested identity and live face/liveness steps.</p>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); window.location.reload(); }}
              className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold"
            >
              Close
            </button>
          </div>
          <div id="specialist-sumsub-websdk-container" className="min-h-[620px] w-full" />
          {message ? <p className="border-t border-black/8 px-5 py-3 text-xs text-black/50">{message}</p> : null}
        </div>
      ) : null}
    </>
  );
}
