import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ACTIVE_APPOINTMENT_STATUSES = ["pending","confirmed","checked_in","in_progress"];
const TRUST_PENDING = ["not_started","pending","in_review"];
const PAYOUT_ATTENTION = ["held","failed","processing"];

function ageLabel(value:string|null|undefined){
  if(!value)return "—";
  const ms=Date.now()-new Date(value).getTime();
  if(ms<0)return "future";
  const hours=Math.floor(ms/3600000);
  if(hours<24)return hours+"h";
  return Math.floor(hours/24)+"d";
}

function tone(kind:"danger"|"warn"|"ok"|"neutral"){
  if(kind==="danger")return "border-red-900/60 bg-red-950/20 text-red-300";
  if(kind==="warn")return "border-amber-900/60 bg-amber-950/20 text-amber-300";
  if(kind==="ok")return "border-emerald-900/60 bg-emerald-950/20 text-emerald-300";
  return "border-zinc-800 bg-zinc-950 text-zinc-300";
}

export default async function ServiceOperationsPage(){
  await requireAdmin();
  const now=new Date().toISOString();
  const [
    appointmentResult,
    ledgerResult,
    reviewResult,
    payoutResult,
    verificationResult,
  ]=await Promise.all([
    supabaseAdmin
      .from("service_appointments")
      .select("id,public_id,service_profile_id,customer_name,starts_at,ends_at,status,payment_status,price,currency,updated_at,service_offerings(name),service_staff(display_name),service_profiles(id,businesses(id,name,slug))")
      .in("status",ACTIVE_APPOINTMENT_STATUSES)
      .order("starts_at",{ascending:true})
      .limit(500),
    supabaseAdmin
      .from("service_payment_ledger")
      .select("id,appointment_id,status,refunded_amount,currency,gross_amount,updated_at")
      .order("updated_at",{ascending:false})
      .limit(1000),
    supabaseAdmin
      .from("travel_refund_reviews")
      .select("id,ledger_id,status,resolution,reason,created_at,updated_at")
      .eq("product","service")
      .in("status",["pending","in_review"])
      .order("updated_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("service_provider_payouts")
      .select("id,appointment_id,provider_user_id,status,currency,provider_net_amount,failure_reason,processing_at,updated_at")
      .in("status",PAYOUT_ATTENTION)
      .order("updated_at",{ascending:false})
      .limit(500),
    supabaseAdmin
      .from("verification_cases")
      .select("id,subject_type,subject_id,status,provider,verification_level,created_at,updated_at")
      .in("subject_type",["service_staff","provider"])
      .in("status",TRUST_PENDING)
      .order("updated_at",{ascending:false})
      .limit(500),
  ]);

  const appointments=appointmentResult.data??[];
  const overdue=appointments.filter((row:any)=>new Date(row.ends_at).getTime()<Date.now());
  const startingSoon=appointments.filter((row:any)=>{
    const start=new Date(row.starts_at).getTime();
    return start>=Date.now()&&start<=Date.now()+24*3600000;
  });

  const ledgerRows=ledgerResult.data??[];
  const ledgerById=new Map(ledgerRows.map((row:any)=>[String(row.id),row]));
  const appointmentByLedger=new Map(ledgerRows.map((row:any)=>[String(row.id),String(row.appointment_id)]));
  const appointmentIds=new Set([
    ...overdue.map((row:any)=>String(row.id)),
    ...(payoutResult.data??[]).map((row:any)=>String(row.appointment_id)),
    ...(reviewResult.data??[]).map((row:any)=>appointmentByLedger.get(String(row.ledger_id))).filter(Boolean) as string[],
  ]);

  let contextAppointments:any[]=[];
  if(appointmentIds.size){
    const {data}=await supabaseAdmin
      .from("service_appointments")
      .select("id,public_id,service_profile_id,customer_name,starts_at,ends_at,status,payment_status,price,currency,updated_at,service_offerings(name),service_staff(display_name),service_profiles(id,businesses(id,name,slug))")
      .in("id",[...appointmentIds]);
    contextAppointments=data??[];
  }
  const appointmentById=new Map([...appointments,...contextAppointments].map((row:any)=>[String(row.id),row]));

  const reviews=(reviewResult.data??[]).map((row:any)=>({
    ...row,
    appointmentId:appointmentByLedger.get(String(row.ledger_id))||null,
    ledger:ledgerById.get(String(row.ledger_id))||null,
  }));
  const payouts=payoutResult.data??[];
  const staleProcessing=payouts.filter((row:any)=>row.status==="processing"&&row.processing_at&&new Date(row.processing_at).getTime()<Date.now()-24*3600000);
  const verification=verificationResult.data??[];
  const providerTrust=verification.filter((row:any)=>row.subject_type==="provider");
  const specialistTrust=verification.filter((row:any)=>row.subject_type==="service_staff");

  const queryErrors=[appointmentResult.error,ledgerResult.error,reviewResult.error,payoutResult.error,verificationResult.error].filter(Boolean);
  const attention=overdue.length+reviews.length+payouts.filter((row:any)=>row.status!=="processing").length+staleProcessing.length+verification.length;

  return <main className="min-h-screen bg-[#050505] px-5 py-10 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">← Command Center</Link>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/accounting/refunds" className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300">Refund reviews</Link>
          <Link href="/admin/payouts" className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300">Provider payouts</Link>
          <Link href="/admin/integrations/verification" className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300">Verification</Link>
        </div>
      </div>

      <header className="mt-6 border-b border-zinc-800 pb-7">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[.22em] text-amber-400">Marketplace services</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Service Operations</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">One triage view for appointments, paid cancellation reviews, provider payouts and provider trust blockers. Resolve each case in its authoritative finance or verification workspace.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-right"><p className="text-xs text-zinc-500">Needs attention</p><p className="text-2xl font-bold text-amber-300">{attention}</p></div>
        </div>
      </header>

      {queryErrors.length>0&&<section className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/20 p-4"><p className="font-semibold text-red-300">Service operations data is partially unavailable</p><p className="mt-1 text-sm text-red-300/70">One or more operational queries failed. Open the underlying workspace before taking financial or trust action.</p></section>}

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Metric label="Overdue active" value={overdue.length} alert={overdue.length>0}/>
        <Metric label="Starting ≤24h" value={startingSoon.length}/>
        <Metric label="Refund reviews" value={reviews.length} alert={reviews.length>0}/>
        <Metric label="Held / failed payouts" value={payouts.filter((row:any)=>["held","failed"].includes(row.status)).length} alert={payouts.some((row:any)=>["held","failed"].includes(row.status))}/>
        <Metric label="Stale processing" value={staleProcessing.length} alert={staleProcessing.length>0}/>
        <Metric label="Provider trust" value={providerTrust.length} alert={providerTrust.length>0}/>
        <Metric label="Specialist trust" value={specialistTrust.length} alert={specialistTrust.length>0}/>
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-2">
        <Panel title="Overdue appointment operations" subtitle="Active appointments whose scheduled end time has passed." href="/admin/accounting/reconciliation">
          {overdue.slice(0,20).map((row:any)=><AppointmentCard key={row.id} row={row}/>)}
          {!overdue.length&&<Empty text="No active service appointments are overdue."/>}
        </Panel>

        <Panel title="Paid cancellation / refund review" subtitle="Customer or provider cancellation requests that still require finance handling." href="/admin/accounting/refunds">
          {reviews.slice(0,20).map((review:any)=>{
            const appointment=review.appointmentId?appointmentById.get(String(review.appointmentId)):null;
            return <div key={review.id} className="border-t border-zinc-900 py-4 first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{appointment?.service_profiles?.businesses?.name||"Service provider"}</p><p className="mt-1 text-xs text-zinc-500">{appointment?.public_id||review.appointmentId||"Appointment unavailable"} · {appointment?.customer_name||"Customer"}</p></div><span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase "+tone("warn")}>{review.status.replaceAll("_"," ")}</span></div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{review.reason||"Paid service cancellation requires finance review."}</p>
              <p className="mt-2 text-xs text-zinc-600">Payment {review.ledger?.status||appointment?.payment_status||"unknown"} · updated {ageLabel(review.updated_at)} ago</p>
            </div>;
          })}
          {!reviews.length&&<Empty text="No open paid service cancellation reviews."/>}
        </Panel>

        <Panel title="Provider payout exceptions" subtitle="Held, failed, processing or stale M-Pesa provider payout records." href="/admin/payouts">
          {payouts.slice(0,20).map((row:any)=>{
            const appointment=appointmentById.get(String(row.appointment_id));
            const stale=row.status==="processing"&&row.processing_at&&new Date(row.processing_at).getTime()<Date.now()-24*3600000;
            return <div key={row.id} className="border-t border-zinc-900 py-4 first:border-t-0">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{appointment?.service_profiles?.businesses?.name||"Service provider"}</p><p className="mt-1 text-xs text-zinc-500">{appointment?.public_id||String(row.appointment_id).slice(0,8)} · {row.currency} {Number(row.provider_net_amount||0).toLocaleString()}</p></div><span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase "+tone(stale||["held","failed"].includes(row.status)?"warn":"neutral")}>{stale?"stale processing":row.status}</span></div>
              {row.failure_reason&&<p className="mt-2 text-sm leading-6 text-zinc-400">{row.failure_reason}</p>}
              <p className="mt-2 text-xs text-zinc-600">Updated {ageLabel(row.updated_at)} ago</p>
            </div>;
          })}
          {!payouts.length&&<Empty text="No provider payout exceptions are open."/>}
        </Panel>

        <Panel title="Provider & specialist trust blockers" subtitle="Human-review verification cases that can block service activation or bookability." href="/admin/integrations/verification">
          {verification.slice(0,20).map((row:any)=><div key={row.id} className="border-t border-zinc-900 py-4 first:border-t-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold capitalize">{row.subject_type.replaceAll("_"," ")}</p><p className="mt-1 font-mono text-xs text-zinc-500">{row.subject_id}</p></div><span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase "+tone("warn")}>{row.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-xs text-zinc-600">{row.verification_level} · {row.provider} · updated {ageLabel(row.updated_at)} ago</p></div>)}
          {!verification.length&&<Empty text="No provider or specialist trust cases need attention."/>}
        </Panel>
      </section>

      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-semibold">Triage only — authoritative actions stay governed</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-500">Service Operations does not move money, approve refunds or invent verification decisions. Use Refund Reviews for cancellation/refund decisions, Provider Payouts for M-Pesa reconciliation, and Verification Operations for provider/specialist trust actions.</p>
      </section>
    </div>
  </main>;
}

function Metric({label,value,alert=false}:{label:string;value:number;alert?:boolean}){return <div className={"rounded-2xl border p-4 "+(alert?"border-amber-500/50 bg-amber-500/10":"border-zinc-800 bg-zinc-950")}><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>}
function Panel({title,subtitle,href,children}:{title:string;subtitle:string;href:string;children:React.ReactNode}){return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p></div><Link href={href} className="text-xs font-semibold text-amber-400">Open source workspace →</Link></div>{children}</section>}
function AppointmentCard({row}:{row:any}){return <div className="border-t border-zinc-900 py-4 first:border-t-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{row.service_profiles?.businesses?.name||"Service provider"}</p><p className="mt-1 text-xs text-zinc-500">{row.public_id} · {row.customer_name} · {row.service_offerings?.name||"Service"}</p></div><span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase "+tone("danger")}>{row.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-xs text-zinc-600">Ended {ageLabel(row.ends_at)} ago · {row.payment_status} · {row.currency} {Number(row.price||0).toLocaleString()}</p></div>}
function Empty({text}:{text:string}){return <p className="border-t border-zinc-900 py-5 text-sm text-zinc-500">{text}</p>}
