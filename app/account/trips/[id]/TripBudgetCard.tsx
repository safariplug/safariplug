"use client";
import { useState } from "react";

export default function TripBudgetCard({tripId,initialAmount,initialCurrency,recorded,remaining,overBudget}:{tripId:string;initialAmount:number|null;initialCurrency:string|null;recorded:number|null;remaining:number|null;overBudget:boolean}){
  const[editing,setEditing]=useState(initialAmount==null);
  const[amount,setAmount]=useState(initialAmount==null?"":String(initialAmount));
  const[currency,setCurrency]=useState(initialCurrency||"KES");
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  async function save(){
    setBusy(true);setMessage("");
    const r=await fetch("/api/account/trips/"+encodeURIComponent(tripId)+"/budget",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({amount:amount===""?null:Number(amount),currency})});
    const j=await r.json().catch(()=>null);
    setBusy(false);
    if(!r.ok){setMessage(j?.error||"Unable to save budget.");return;}
    window.location.reload();
  }
  const recordedText=recorded==null?"No recorded costs yet":initialCurrency+" "+recorded.toLocaleString()+" recorded · "+initialCurrency+" "+Number(remaining||0).toLocaleString()+" "+(overBudget?"over/remaining":"remaining");
  return <section className={"rounded-2xl p-5 "+(overBudget?"border border-red-200 bg-red-50":"bg-white")}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">Trip budget</p>{initialAmount!=null&&initialCurrency?<><p className="mt-2 text-3xl font-semibold">{initialCurrency} {initialAmount.toLocaleString()}</p><p className="mt-1 text-xs text-black/45">{recordedText}</p></>:<p className="mt-2 text-sm text-black/50">Set a planning budget so Amani can compare it with real recorded trip costs.</p>}</div><button onClick={()=>setEditing(v=>!v)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold">{editing?"Close":"Edit"}</button></div>
    {editing&&<div className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_auto]"><input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Budget amount" className="rounded-xl border border-black/10 px-3 py-2.5 text-sm"/><input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase().slice(0,3))} maxLength={3} className="rounded-xl border border-black/10 px-3 py-2.5 text-sm uppercase"/><button disabled={busy} onClick={()=>void save()} className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy?"Saving…":"Save"}</button></div>}
    {message&&<p className="mt-2 text-xs text-red-600">{message}</p>}
    {overBudget&&<p className="mt-3 text-xs font-semibold text-red-700">Recorded trip costs currently exceed this planning budget. SafariPlug has not moved or cancelled anything automatically.</p>}
  </section>
}