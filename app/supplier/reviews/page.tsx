"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Review = {
  id:string;
  rating:number;
  dimensions:Record<string,number>;
  title:string|null;
  body:string|null;
  verified_booking:boolean;
  supplier_response:string|null;
  supplier_responded_at:string|null;
  created_at:string;
};

export default function SupplierReviewsPage() {
  const [reviews,setReviews]=useState<Review[]>([]);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");

  async function load() {
    const r=await fetch("/api/supplier/reviews",{cache:"no-store"});
    const j=await r.json().catch(()=>null);
    if(!r.ok){setMessage(j?.error||"Unable to load reviews.");return;}
    setReviews(j.reviews||[]);
  }
  useEffect(()=>{void load();},[]);

  const average=useMemo(()=>reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:null,[reviews]);
  async function respond(reviewId:string){
    const response=String(drafts[reviewId]||"").trim();
    if(!response)return;
    setBusy(reviewId);setMessage("");
    const r=await fetch("/api/supplier/reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reviewId,response})});
    const j=await r.json().catch(()=>null);
    setBusy(null);
    if(!r.ok){setMessage(j?.error||"Unable to save response.");return;}
    setDrafts(prev=>({...prev,[reviewId]:""}));
    setMessage("Provider response published.");
    await load();
  }

  return <main className="mx-auto max-w-5xl px-6 py-10">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><Link href="/supplier" className="text-sm font-semibold">← Supplier home</Link><p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-black/40">Traveler trust</p><h1 className="mt-2 text-4xl font-semibold">Verified reviews</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">Only approved reviews tied to completed SafariPlug bookings appear here. Your public response is shown alongside the review.</p></div>
      {average!==null&&<div className="rounded-2xl bg-black px-5 py-4 text-right text-white"><p className="text-xs text-white/45">Average</p><p className="mt-1 text-3xl font-semibold">{average.toFixed(1)}</p><p className="text-xs text-white/45">{reviews.length} review{reviews.length===1?"":"s"}</p></div>}
    </div>

    {message&&<div className="mt-6 rounded-xl border border-black/10 bg-black/[.03] p-4 text-sm">{message}</div>}

    <div className="mt-8 space-y-4">
      {reviews.map(review=><article key={review.id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xl font-semibold">{"★".repeat(review.rating)}<span className="text-black/10">{"★".repeat(5-review.rating)}</span></p>{review.title&&<h2 className="mt-2 font-semibold">{review.title}</h2>}</div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">Verified booking</span>
        </div>
        {review.body&&<p className="mt-3 text-sm leading-6 text-black/55">{review.body}</p>}
        {Object.keys(review.dimensions||{}).length>0&&<div className="mt-4 flex flex-wrap gap-2">{Object.entries(review.dimensions).map(([key,value])=><span key={key} className="rounded-full bg-black/[.04] px-2.5 py-1 text-[10px] capitalize text-black/55">{key} {value}/5</span>)}</div>}
        {review.supplier_response?<div className="mt-5 rounded-xl bg-[#f7f7f4] p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-black/35">Your response</p><p className="mt-2 text-sm leading-6 text-black/60">{review.supplier_response}</p></div>:<div className="mt-5"><textarea value={drafts[review.id]||""} onChange={e=>setDrafts(prev=>({...prev,[review.id]:e.target.value}))} rows={3} maxLength={2000} placeholder="Write a factual, respectful response…" className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm"/><button onClick={()=>void respond(review.id)} disabled={busy===review.id||!String(drafts[review.id]||"").trim()} className="mt-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy===review.id?"Publishing…":"Publish response"}</button></div>}
      </article>)}
      {!reviews.length&&<div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-black/45">No approved verified reviews yet.</div>}
    </div>
  </main>;
}
