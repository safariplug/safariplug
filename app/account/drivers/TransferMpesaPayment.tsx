"use client";

import { useState } from "react";

export default function TransferMpesaPayment({
  requestId,
  defaultPhone = "",
}: {
  requestId: string;
  defaultPhone?: string;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function pay() {
    if (!phone.trim()) {
      setMessage("Enter the M-Pesa phone number.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/transfers/driver/mpesa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, phone }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Unable to start M-Pesa payment.");
      setMessage(data?.alreadyPaid ? "This transfer is already paid." : data?.message || "Check your phone to complete the M-Pesa payment.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start M-Pesa payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-950">Pay this accepted transfer</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="M-Pesa phone e.g. 0712345678"
          className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Starting…" : "Pay with M-Pesa"}
        </button>
      </div>
      {message ? <p className="mt-2 text-xs leading-5 text-emerald-900">{message}</p> : null}
      <p className="mt-2 text-[11px] leading-4 text-emerald-800/70">The ride can only be marked completed after SafariPlug records a successful payment callback.</p>
    </div>
  );
}
