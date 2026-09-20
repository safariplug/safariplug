"use client";

import { useState } from "react";

export default function StaffVerificationLink({
  staffId,
  linked,
  verified,
}: {
  staffId: string;
  linked: boolean;
  verified: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [claimUrl, setClaimUrl] = useState("");
  const [message, setMessage] = useState("");

  async function createLink() {
    setBusy(true);
    setMessage("");
    setClaimUrl("");
    try {
      const response = await fetch("/api/services/provider-verification/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create_claim", staffId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Unable to create verification link.");
      setClaimUrl(body.claimUrl || "");
      setMessage("Secure specialist link created. SafariPlug has not sent it externally; share it with this specialist yourself.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create verification link.");
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return <p className="mt-3 text-xs font-semibold text-emerald-700">SafariPlug trust review approved.</p>;
  }

  if (linked) {
    return (
      <p className="mt-3 text-xs leading-5 text-amber-700">
        SafariPlug account linked. The specialist must sign in and request their SafariPlug trust review at{" "}
        <a href="/services/provider-verification" className="font-semibold underline">their verification page</a>.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void createLink()}
        className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create secure specialist link"}
      </button>
      {claimUrl ? (
        <div className="mt-3 rounded-xl bg-black/[.035] p-3">
          <p className="break-all text-xs text-black/60">{claimUrl}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(claimUrl);
              setMessage("Specialist link copied. SafariPlug has not sent it externally.");
            }}
            className="mt-2 text-xs font-semibold underline"
          >
            Copy link
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs leading-5 text-black/45">{message}</p> : null}
    </div>
  );
}
