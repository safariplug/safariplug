"use client";

import { useEffect, useState } from "react";

type Notification = {
  id:string;
  appointment_id:string;
  type:string;
  title:string;
  body:string;
  status:string;
  read_at:string|null;
  created_at:string;
};

export default function BusinessNotificationInbox(){
  const [items,setItems]=useState<Notification[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const unread=items.filter(item=>!item.read_at).length;

  async function load(){
    setLoading(true);
    try{
      const r=await fetch("/api/account/notifications",{cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      if(r.ok)setItems(j.notifications||[]);
    }finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  async function markRead(id?:string){
    setBusy(true);
    try{
      const r=await fetch("/api/account/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(id?{id}:{})});
      if(r.ok){
        const now=new Date().toISOString();
        setItems(current=>current.map(item=>!id||item.id===id?{...item,read_at:item.read_at||now,status:"read"}:item));
      }
    }finally{setBusy(false);}
  }

  return <div className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-black/45">{loading?"Loading notifications…":unread+" unread · "+items.length+" recent"}</p></div>
      {unread>0&&<button disabled={busy} onClick={()=>void markRead()} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold disabled:opacity-50">Mark all read</button>}
    </div>
    <div className="mt-5 space-y-3">
      {items.map(item=><article key={item.id} className={"rounded-2xl border p-5 "+(item.read_at?"border-black/8 bg-white":"border-amber-200 bg-amber-50")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-semibold">{item.title}</p><p className="mt-2 max-w-3xl text-sm leading-6 text-black/55">{item.body}</p><p className="mt-3 text-[11px] text-black/35">{new Date(item.created_at).toLocaleString()} · {item.type.replaceAll("_"," ")}</p></div>
          {!item.read_at&&<button disabled={busy} onClick={()=>void markRead(item.id)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50">Mark read</button>}
        </div>
      </article>)}
      {!loading&&!items.length&&<div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center text-sm text-black/40">No provider notifications yet.</div>}
    </div>
  </div>;
}
