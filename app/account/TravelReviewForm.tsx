"use client";

import { useState } from "react";

type Product="hotel"|"activity"|"transfer";
type ExistingReview={rating:number;title:string|null;body:string|null;moderation_status:string;dimensions:Record<string,number>};

const DIMENSIONS:Record<Product,string[]>={
  hotel:["cleanliness","service","location","value"],
  activity:["experience","guide","logistics","value"],
  transfer:["punctuality","driver","vehicle","safety"],
};

export default function TravelReviewForm({product,sourceId,eligible,existing}:{product:Product;sourceId:string;eligible:boolean;existing?:ExistingReview|null}){
  const[rating,setRating]=useState(existing?.rating||5);
  const[title,setTitle]=useState(existing?.title||"");
  const[body,setBody]=useState(existing?.body||"");
  const[dimensions,setDimensions]=useState<Record<string,number>>(()=>Object.fromEntries(DIMENSIONS[product].map(key=>[key,existing?.dimensions?.[key]||5])));
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  if(existing)return <div className="mt-4 rounded-xl bg-emerald-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Your verified review</p><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{existing.moderation_status}</span></div><p className="mt-2 text-xl">{"★".repeat(existing.rating)}<span className="text-black/10">{"★".repeat(5-existing.rating)}</span></p>{existing.title&&<p className="mt-2 font-semibold">{existing.title}</p>}{existing.body&&<p className="mt-1 text-xs leading-5 text-black/55">{existing.body}</p>}</div>;
  if(!eligible)return null;
  async function submit(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/account/travel-reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({product,sourceId,rating,title,body,dimensions})});
    const j=await r.json().catch(()=>null);
    setBusy(false);
    setMessage(r.ok?"Review saved and sent for moderation.":j?.error||"Unable to save review.");
    if(r.ok)window.location.reload();
  }
  return <div className="mt-4 rounded-xl border border-black/10 bg-[#f7f7f4] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-black/40">Verified SafariPlug review</p><p className="mt-1 text-sm font-semibold">How was this {product}?</p><div className="mt-3 grid grid-cols-2 gap-2">{DIMENSIONS[product].map(key=><label key={key} className="text-[11px] font-semibold capitalize">{key}<select value={dimensions[key]} onChange={e=>setDimensions(prev=>({...prev,[key]:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-2 text-xs">{[5,4,3,2,1].map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}</div><label className="mt-3 block text-xs font-semibold">Overall<select value={rating} onChange={e=>setRating(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2 py-2 text-xs">{[5,4,3,2,1].map(v=><option key={v} value={v}>{v} / 5</option>)}</select></label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="Short title (optional)" className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"/><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={3} placeholder="Share what another traveler should know." className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"/><button disabled={busy} onClick={()=>void submit()} className="mt-2 rounded-xl bg-black px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Submit verified review"}</button>{message&&<p className="mt-2 text-xs text-black/55">{message}</p>}</div>;
}
