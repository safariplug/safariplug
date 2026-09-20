"use client";

import { useState } from "react";

export default function RefundReviewActions({
  product,
  ledgerId,
  provider,
  reason,
  review,
  canManageFinance,
}:{
  product:"hotel"|"transfer"|"activity"|"service"|"food";
  ledgerId:string;
  provider:string;
  reason:string;
  review:{id:string;status:string;resolution:string|null;notes:string|null}|null;
  canManageFinance:boolean;
}) {
  const [notes,setNotes]=useState(review?.notes||"");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [correctionNotes,setCorrectionNotes]=useState("");
  const resolved=review?.status==="resolved";

  if(!canManageFinance) {
    return <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
      <p className="font-semibold text-zinc-100">Finance review</p>
      <p className="mt-2 text-xs leading-5 text-amber-300">Read only. A super admin or finance manager is required to start, resolve, or reopen a finance review.</p>
      {review?.notes?<p className="mt-3 rounded-xl bg-zinc-950 p-3 text-xs leading-5 text-zinc-400">{review.notes}</p>:null}
    </div>;
  }

  async function act(action:"start_review"|"resolve"|"reopen",resolution?:string,overrideNotes?:string) {
    setBusy(true);setMessage("");setError("");
    try{
      const response=await fetch("/api/admin/accounting/travel-refunds",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,product,ledgerId,provider,reason,notes:(overrideNotes??notes).trim(),resolution}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body?.error||"Refund review update failed.");
      setMessage(body?.message||"Refund review updated.");
      window.setTimeout(()=>window.location.reload(),800);
    }catch(err){
      setError(err instanceof Error?err.message:"Refund review update failed.");
    }finally{setBusy(false)}
  }

  return <div className="mt-5 rounded-xl border border-zinc-800 bg-black p-4">
    <p className="font-semibold text-zinc-100">Finance review</p>
    <p className="mt-2 text-xs leading-5 text-zinc-500">
      Record the human finance decision only. This does not issue money or change payment status.
    </p>
    <textarea
      value={notes}
      onChange={e=>setNotes(e.target.value)}
      disabled={resolved}
      placeholder="Finance review notes"
      className="mt-3 min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
    />
    {resolved
      ?<div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-3">
        <p className="text-xs leading-5 text-emerald-200">Resolved finance decisions are locked against silent overwrite. To correct one, record a new correction reason and reopen it for review. The prior decision stays in append-only history.</p>
        <textarea
          value={correctionNotes}
          onChange={e=>setCorrectionNotes(e.target.value)}
          placeholder="Reason for reopening this resolved decision"
          className="mt-3 min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <button
          disabled={busy||!correctionNotes.trim()}
          onClick={()=>void act("reopen",undefined,correctionNotes)}
          className="mt-3 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reopen for correction
        </button>
      </div>
      :<div className="mt-3 flex flex-wrap gap-2">
        {(!review||review.status==="pending")?<button disabled={busy} onClick={()=>void act("start_review")} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold">Start review</button>:null}
        <button disabled={busy||!notes.trim()} onClick={()=>void act("resolve","refund_required")} className="rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-300">Refund required</button>
        <button disabled={busy||!notes.trim()} onClick={()=>void act("resolve","no_refund_due")} className="rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300">No refund due</button>
        <button disabled={busy||!notes.trim()} onClick={()=>void act("resolve","refunded_externally")} className="rounded-xl border border-emerald-700/50 px-3 py-2 text-xs font-bold text-emerald-300">Refund handled externally</button>
      </div>}
    {message?<p className="mt-3 text-xs text-emerald-300">{message}</p>:null}
    {error?<p className="mt-3 text-xs text-red-300">{error}</p>:null}
  </div>;
}
