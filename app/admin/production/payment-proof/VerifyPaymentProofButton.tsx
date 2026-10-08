"use client";
import { useState } from "react";

export default function VerifyPaymentProofButton({product,sourceId}:{product:"hotel"|"activity"|"transfer"|"service";sourceId:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  async function verify(){
    const notes=window.prompt("Optional verification note (for example: tested on production device / receipt checked):","")||"";
    setBusy(true);setMessage("");
    const r=await fetch("/api/admin/production/payment-proof",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({product,sourceId,notes})});
    const j=await r.json().catch(()=>null);
    setBusy(false);
    if(!r.ok){setMessage(j?.error||"Unable to record proof.");return;}
    setMessage("Verified.");
    window.location.reload();
  }
  return <div><button disabled={busy} onClick={()=>void verify()} className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-bold text-black disabled:opacity-40">{busy?"Checking…":"Verify production proof"}</button>{message&&<p className="mt-1 text-[10px] text-zinc-400">{message}</p>}</div>;
}
