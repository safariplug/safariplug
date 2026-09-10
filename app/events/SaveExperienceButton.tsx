"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function SaveExperienceButton({ eventId }: { eventId:string }) {
  const [saved,setSaved]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{fetch("/api/account/saved").then(async r=>{if(!r.ok)return;const j=await r.json();setSaved((j.saved||[]).some((x:any)=>x.event_id===eventId));}).catch(()=>{});},[eventId]);
  async function toggle(){setBusy(true);setMessage("");const r=await fetch(saved?`/api/account/saved?eventId=${encodeURIComponent(eventId)}`:"/api/account/saved",{method:saved?"DELETE":"POST",headers:{"content-type":"application/json"},body:saved?undefined:JSON.stringify({eventId})});const j=await r.json().catch(()=>({}));setBusy(false);if(r.status===401){window.location.href=`/login?next=${encodeURIComponent(`/events/${eventId}`)}`;return;}if(!r.ok){setMessage(j.error||"Could not update saved experiences.");return;}setSaved(!saved);setMessage(saved?"Removed from saved":"Saved to your collection");}
  return <div className="mt-3"><button onClick={toggle} disabled={busy} className="w-full rounded-full border border-white/15 px-6 py-3 text-center text-sm font-bold text-white transition hover:border-[#e7c98d] hover:text-[#e7c98d] disabled:opacity-50">{busy?"Saving…":saved?"♥ Saved":"♡ Save Experience"}</button>{message&&<p className="mt-2 text-center text-xs text-white/50">{message}{saved&&<>{" "}<Link href="/account/saved" className="text-[#e7c98d]">View saved →</Link></>}</p>}</div>;
}
