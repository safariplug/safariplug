"use client";

import { useState } from "react";

type Action = { status:string; label:string };
type Appointment = any;

const ACTIONS: Record<string,Action[]> = {
  pending:[{status:"confirmed",label:"Confirm"},{status:"cancelled",label:"Cancel"}],
  confirmed:[{status:"checked_in",label:"Check in"},{status:"no_show",label:"No-show"},{status:"cancelled",label:"Cancel"}],
  checked_in:[{status:"in_progress",label:"Start service"},{status:"no_show",label:"No-show"},{status:"cancelled",label:"Cancel"}],
  in_progress:[{status:"completed",label:"Complete"},{status:"cancelled",label:"Cancel"}],
};

function formatTime(value:string,timeZone?:string|null){
  try{return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:timeZone||undefined}).format(new Date(value));}
  catch{return new Date(value).toLocaleString();}
}
function paymentLabel(status:string){
  const value=String(status||"unpaid").replaceAll("_"," ");
  if(value==="paid")return "Paid";
  if(value==="refunded")return "Refunded";
  if(value==="partially refunded")return "Partially refunded";
  return "Payment "+value;
}
function refundLabel(review:any){
  if(!review)return null;
  if(review.status==="resolved"){
    if(review.resolution==="refunded_externally")return "Refund confirmed";
    if(review.resolution==="no_refund_due")return "No refund due";
    return "Finance review resolved";
  }
  if(review.resolution==="refund_required")return "Refund required · finance processing";
  return "Cancellation / refund under review";
}
function payoutLabel(payout:any){
  if(!payout)return "No payout generated";
  const labels:Record<string,string>={eligible:"Earnings ready for review",approved:"Payout approved",processing:"M-Pesa processing",paid:"Provider paid",held:"Payout on hold",failed:"Payout failed",cancelled:"Payout cancelled"};
  return labels[payout.status]||String(payout.status||"").replaceAll("_"," ");
}

export default function AppointmentOperations({appointments,timeZone}:{appointments:Appointment[];timeZone?:string|null}){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function act(appointment:Appointment,action:Action){
    let reason="";
    if(action.status==="cancelled"||action.status==="no_show"){
      reason=window.prompt(action.status==="cancelled"?"Why are you cancelling this appointment?":"Why is this customer being marked no-show?")?.trim()||"";
      if(!reason)return;
    }else{
      reason="Provider action: "+action.label;
    }
    setBusy(true); setMessage("");
    try{
      const r=await fetch("/api/business/services/manage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"appointment_status",appointmentId:appointment.id,status:action.status,reason,serviceProfileId:appointment.service_profile_id})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||"Unable to update appointment");
      setMessage(j.message||"Appointment updated.");
      window.location.reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to update appointment");}
    finally{setBusy(false);}
  }

  return <section className="rounded-[2rem] bg-white p-7">
    <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-black/40">Calendar</p>
    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Customer appointments</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">Manage the service lifecycle here. Paid cancellations go to SafariPlug finance review; completed paid appointments become eligible for payout only after payout safety checks pass.</p>
    {message&&<div className="mt-4 rounded-xl bg-black px-4 py-3 text-sm text-white">{message}</div>}
    <div className="mt-7 space-y-4">
      {appointments.map((a:any)=>{
        const refund=refundLabel(a.refund_review);
        const latestEvent=a.status_events?.[a.status_events.length-1];
        const reviewOpen=Boolean(a.refund_review&&a.refund_review.status!=="resolved");
        return <div key={a.id} className="rounded-2xl border border-black/8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold">{a.customer_name}</p>
              <p className="mt-1 text-xs text-black/45">{formatTime(a.starts_at,timeZone)} · {a.service_offerings?.name||"Service"} · {a.service_staff?.display_name||"Team"}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">{a.public_id} · {String(a.status).replaceAll("_"," ")} · {paymentLabel(a.payment_status)}</p>
            </div>
            <span className="text-sm font-semibold">{a.currency} {Number(a.price).toLocaleString()}</span>
          </div>

          {a.customer_notes&&<div className="mt-4 rounded-xl bg-[#f7f7f4] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">Customer booking note</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/60">{a.customer_notes}</p></div>}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={"rounded-xl p-4 "+(refund?"bg-amber-50":"bg-black/[.035]")}>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">Cancellation / refund</p>
              <p className="mt-2 text-sm font-semibold">{refund||"No refund review"}</p>
              {a.refund_review?.reason&&<p className="mt-1 text-xs leading-5 text-black/50">{a.refund_review.reason}</p>}
            </div>
            <div className={"rounded-xl p-4 "+((a.payout?.status==="held"||a.payout?.status==="failed")?"bg-amber-50":"bg-black/[.035]")}>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/35">Payout impact</p>
              <p className="mt-2 text-sm font-semibold">{payoutLabel(a.payout)}</p>
              {a.payout?.failure_reason&&<p className="mt-1 text-xs leading-5 text-black/50">{a.payout.failure_reason}</p>}
              {a.payout?.payout_reference&&<p className="mt-1 font-mono text-[11px] text-black/45">{a.payout.payout_reference}</p>}
            </div>
          </div>

          {latestEvent&&<p className="mt-3 text-xs leading-5 text-black/40">Latest: {String(latestEvent.to_status).replaceAll("_"," ")} by {latestEvent.actor_type}{latestEvent.note?" · "+latestEvent.note:""} · {formatTime(latestEvent.created_at,timeZone)}</p>}

          {ACTIONS[a.status]?.length>0&&<div className="mt-4 flex flex-wrap gap-2">
            {ACTIONS[a.status].map((action)=><button key={action.status} disabled={busy||(action.status==="cancelled"&&reviewOpen)} onClick={()=>void act(a,action)} className={"rounded-xl px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 "+((action.status==="cancelled"||action.status==="no_show")?"border border-black/10 bg-white text-black/65":"bg-black text-white")}>{action.status==="cancelled"&&reviewOpen?"Cancellation under finance review":action.label}</button>)}
          </div>}
        </div>;
      })}
      {!appointments.length&&<div className="rounded-2xl border border-dashed border-black/10 py-12 text-center text-sm text-black/45">Your appointment calendar is clear.</div>}
    </div>
  </section>;
}
