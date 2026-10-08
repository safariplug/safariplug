"use client";
import { useState } from "react";

export default function RunProductionSmokeButton(){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  async function run(){
    setBusy(true);setMessage("");
    const response=await fetch("/api/admin/production/public-smoke",{method:"POST"});
    const json=await response.json().catch(()=>null);
    setBusy(false);
    if(!response.ok){setMessage(json?.error||"Unable to run production smoke.");return;}
    const failures=Array.isArray(json?.failures)?json.failures.length:0;
    setMessage(failures?"Smoke failed with "+failures+" issue"+(failures===1?"":"s")+".":"Production smoke passed.");
    window.location.reload();
  }
  return <div className="flex flex-col items-start gap-2 sm:items-end"><button onClick={()=>void run()} disabled={busy} className="rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40">{busy?"Running production smoke…":"Run automated public smoke"}</button>{message&&<p className="text-[10px] text-zinc-500">{message}</p>}</div>;
}