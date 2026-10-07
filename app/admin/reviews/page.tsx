"use client";

import Link from "next/link";
import { useEffect,useState } from "react";

type Review={
  id:string;product_type:string;rating:number;title:string|null;body:string|null;verified_booking:boolean;
  moderation_status:string;moderation_note:string|null;supplier_response:string|null;created_at:string;
  businesses:{name:string|null;slug:string|null}|null;
  media:Array<{id:string;url:string|null;moderation_status:string}>;
  reports:Array<{id:string;reason:string;details:string|null;status:string;created_at:string}>;
};

export default function ReviewModerationPage(){
  const[reviews,setReviews]=useState<Review[]>([]);
  const[status,setStatus]=useState("pending");
  const[busy,setBusy]=useState<string|null>(null);
  const[notes,setNotes]=useState<Record<string,string>>({});
  const[message,setMessage]=useState("");

  async function load(nextStatus=status){
    const r=await fetch(`/api/admin/reviews?status=${encodeURIComponent(nextStatus)}`,{cache:"no-store"});
    const j=await r.json().catch(()=>null);
    if(!r.ok){setMessage(j?.error||"Unable to load reviews.");return;}
    setReviews(j.reviews||[]);
  }
  useEffect(()=>{void load(status);},[status]);

  async function moderate(reviewId:string,action:"approve"|"reject"|"mark_reported"){
    setBusy(reviewId);setMessage("");
    const r=await fetch("/api/admin/reviews",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reviewId,action,note:notes[reviewId]||""})});
    const j=await r.json().catch(()=>null);
    setBusy(null);
    if(!r.ok){setMessage(j?.error||"Unable to moderate review.");return;}
    setMessage("Review moderation saved.");
    await load(status);
  }

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-6xl">
    <Link href="/admin" className="text-sm text-amber-400">← Command Center</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Trust & safety</p><h1 className="mt-2 text-4xl font-semibold">Review moderation</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Moderate only SafariPlug reviews tied to verified completed bookings. Approval controls public visibility; rejecting a review does not alter the underlying booking.</p></div><select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"><option value="pending">Pending</option><option value="approved">Approved</option><option value="reported">Reported</option><option value="rejected">Rejected</option><option value="all">All</option></select></div>
    {message&&<div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">{message}</div>}
    <div className="mt-7 space-y-4">{reviews.map(review=><article key={review.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-zinc-500">{review.product_type} · {review.businesses?.name||"Business not linked"}</p><p className="mt-2 text-2xl font-semibold">{"★".repeat(review.rating)}<span className="text-zinc-800">{"★".repeat(5-review.rating)}</span></p>{review.title&&<h2 className="mt-2 font-semibold">{review.title}</h2>}</div><span className="rounded-full border border-zinc-800 px-2.5 py-1 text-[10px] uppercase text-zinc-400">{review.moderation_status}</span></div>{review.body&&<p className="mt-4 text-sm leading-6 text-zinc-400">{review.body}</p>}{review.media?.length>0&&<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{review.media.map(media=>media.url?<div key={media.id} className="overflow-hidden rounded-xl border border-zinc-800"><img src={media.url} alt="Review media for moderation" className="aspect-square h-full w-full object-cover"/><p className="px-2 py-1 text-[9px] uppercase text-zinc-500">{media.moderation_status}</p></div>:null)}</div>}{review.reports?.length>0&&<div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Open report{review.reports.length===1?"":"s"}</p>{review.reports.map(report=><div key={report.id} className="mt-2 text-xs text-amber-100/70"><strong>{report.reason}</strong>{report.details?` · ${report.details}`:""}</div>)}</div>}<p className="mt-3 text-[10px] uppercase tracking-wider text-emerald-300">Verified SafariPlug booking</p>{review.supplier_response&&<div className="mt-4 rounded-xl bg-black/30 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Supplier response</p><p className="mt-1 text-sm text-zinc-400">{review.supplier_response}</p></div>}<textarea value={notes[review.id]||review.moderation_note||""} onChange={e=>setNotes(prev=>({...prev,[review.id]:e.target.value}))} rows={2} placeholder="Internal moderation note (optional)" className="mt-4 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm"/><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy===review.id} onClick={()=>void moderate(review.id,"approve")} className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-bold text-black disabled:opacity-40">Approve</button><button disabled={busy===review.id} onClick={()=>void moderate(review.id,"reject")} className="rounded-xl border border-red-800 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Reject</button><button disabled={busy===review.id} onClick={()=>void moderate(review.id,"mark_reported")} className="rounded-xl border border-amber-800 px-4 py-2 text-xs font-bold text-amber-300 disabled:opacity-40">Flag reported</button></div></article>)}{!reviews.length&&<div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">No reviews in this queue.</div>}</div>
  </div></main>;
}
