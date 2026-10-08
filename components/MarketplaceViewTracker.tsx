"use client";
import { useEffect } from "react";

function sessionId(){
  const key="sp_conversion_session";
  const existing=window.sessionStorage.getItem(key);
  if(existing)return existing;
  const value=crypto.randomUUID();
  window.sessionStorage.setItem(key,value);
  return value;
}

export default function MarketplaceViewTracker({surface}:{surface:"hotels"|"activities"|"transfers"|"services"|"restaurants"|"destinations"|"events"|"amani"}){
  useEffect(()=>{
    const id=sessionId();
    void fetch("/api/analytics/conversion",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventName:"marketplace_view",surface,sessionId:id,pathname:window.location.pathname+window.location.search}),keepalive:true}).catch(()=>{});
  },[surface]);
  return null;
}
