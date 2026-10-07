"use client";
import { useState } from "react";

export default function ReviewMediaUploader({reviewId}:{reviewId:string}){
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState("");
  async function upload(file:File|null){
    if(!file)return;
    setBusy(true);setMessage("");
    const form=new FormData();form.set("reviewId",reviewId);form.set("file",file);
    const r=await fetch("/api/account/review-media",{method:"POST",body:form});
    const j=await r.json().catch(()=>null);
    setBusy(false);
    setMessage(r.ok?"Photo uploaded and sent for moderation.":j?.error||"Unable to upload photo.");
  }
  return <div className="mt-3 rounded-xl border border-black/8 bg-white p-3"><label className="text-[10px] font-semibold uppercase tracking-[.14em] text-black/35">Add traveler photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>void upload(e.target.files?.[0]||null)} className="mt-2 block w-full text-xs"/></label><p className="mt-2 text-[10px] leading-4 text-black/35">Up to 4 photos per review. JPEG, PNG or WebP under 8MB. Photos are moderated before public display.</p>{message&&<p className="mt-2 text-xs text-black/55">{message}</p>}</div>;
}