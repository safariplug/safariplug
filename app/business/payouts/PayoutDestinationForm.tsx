"use client";

import { useState } from "react";

export default function PayoutDestinationForm({ phone, status }: { phone?: string | null; status?: string | null }) {
  const [value, setValue] = useState(phone || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/business/payouts/destination", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ phone:value }) });
    const body = await response.json().catch(()=>({}));
    setBusy(false);
    if (!response.ok) { setMessage(body.error || "Unable to save payout destination."); return; }
    setMessage("Saved. SafariPlug verification is required before payouts can be released.");
  }
  return <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={value} onChange={e=>setValue(e.target.value)} placeholder="e.g. 0712 345 678" className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30" inputMode="tel"/><button disabled={busy||!value.trim()} onClick={save} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save number"}</button>{message&&<p className="text-xs text-black/50 sm:self-center">{message}</p>}</div>;
}
