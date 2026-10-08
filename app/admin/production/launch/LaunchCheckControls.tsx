"use client";
import { useState } from "react";

export default function LaunchCheckControls({checkKey,status}:{checkKey:string;status:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  async function update(next:"passed"|"failed"|"pending"){
    const note=next==="pending"?"":window.prompt("Optional verification note:","")||"";
    setBusy(true);setMessage("");
    const r=await fetch("/api/admin/production/launch-check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({checkKey,status:next,note})});
    const j=await r.json().catch(()=>null);
    setBusy(false);
    if(!r.ok){setMessage(j?.error||"Unable to update check.");return;}
    window.location.reload();
  }
  return <div className="flex flex-wrap items-center gap-2">
    <button disabled={busy} onClick={()=>void update("passed")} className="rounded-lg bg-emerald-300 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">Pass</button>
    <button disabled={busy} onClick={()=>void update("failed")} className="rounded-lg bg-red-300 px-3 py-2 text-[11px] font-bold text-black disabled:opacity-40">Fail</button>
    {status!=="pending"&&<button disabled={busy} onClick={()=>void update("pending")} className="rounded-lg border border-zinc-700 px-3 py-2 text-[11px] font-bold text-zinc-300 disabled:opacity-40">Reset</button>}
    {message&&<span className="text-[10px] text-zinc-500">{message}</span>}
  </div>;
}
