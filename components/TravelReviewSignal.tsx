"use client";
import { useEffect, useState } from "react";

type Signal={count:number;averageRating:number|null;firstPhotoUrl:string|null;productName:string|null};

export default function TravelReviewSignal({product,provider,productRef}:{product:"hotel"|"activity"|"transfer";provider:string;productRef:string}){
  const[signal,setSignal]=useState<Signal|null>(null);
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams({product,provider,ref:productRef});
    fetch("/api/public/travel-review-signal?"+params.toString(),{cache:"no-store"})
      .then(r=>r.ok?r.json():null)
      .then(v=>{if(active&&v)setSignal(v)})
      .catch(()=>{});
    return()=>{active=false};
  },[product,provider,productRef]);
  if(!signal||!signal.count||signal.averageRating==null)return null;
  return <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2">
    {signal.firstPhotoUrl?<img src={signal.firstPhotoUrl} alt="Traveler review" className="h-10 w-10 rounded-lg object-cover"/>:null}
    <div><p className="text-xs font-semibold text-emerald-900">{signal.averageRating.toFixed(1)} ★ · {signal.count} verified review{signal.count===1?"":"s"}</p><p className="mt-0.5 text-[10px] text-emerald-900/60">SafariPlug verified bookings</p></div>
  </div>;
}
