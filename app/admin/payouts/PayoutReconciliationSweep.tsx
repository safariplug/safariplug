"use client";

import { useState } from "react";

export default function PayoutReconciliationSweep({ canManageFinance }: { canManageFinance: boolean }) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  if(!canManageFinance) return null;

  async function sweep(){
    if(!window.confirm("Move payouts stuck in processing for more than 24 hours into held reconciliation?")) return;
    setBusy(true); setMessage("");
    try{
      const r=await fetch("/api/admin/payouts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"sweep_stale"})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||"Sweep failed");
      setMessage(`${j.movedToHeld||0} stale payout(s) moved to reconciliation`);
      window.location.reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Sweep failed");}
    finally{setBusy(false);}
  }

  return <div className="flex items-center gap-3">
    <button disabled={busy} onClick={sweep} className="rounded-full border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-300 disabled:opacity-50">Sweep stale processing</button>
    {message&&<span className="text-xs text-white/45">{message}</span>}
  </div>;
}
