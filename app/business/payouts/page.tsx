import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import PayoutDestinationForm from "./PayoutDestinationForm";

export const dynamic = "force-dynamic";

const STATUS: Record<string,string> = {
  eligible:"Ready for review",
  approved:"Approved for payout",
  processing:"Processing with M-Pesa",
  paid:"Paid",
  failed:"Failed",
  held:"On hold",
  cancelled:"Cancelled",
};

function money(value:number,currency:string){
  return currency + " " + Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}

function totalsByCurrency(rows:any[]){
  const totals=new Map<string,number>();
  for(const row of rows){
    const currency=String(row.currency||"KES").toUpperCase();
    totals.set(currency,(totals.get(currency)||0)+Number(row.provider_net_amount||0));
  }
  return [...totals.entries()].map(([currency,total])=>money(total,currency)).join(" · ") || "KES 0.00";
}

export default async function ProviderPayoutsPage() {
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)){
    redirect("/login?next=/business/payouts");
  }

  const [{data:payouts},{data:account},{data:verification},{data:businesses}]=await Promise.all([
    supabaseAdmin
      .from("service_provider_payouts")
      .select("id,appointment_id,service_profile_id,currency,gross_amount,platform_fee_percent,platform_fee_amount,processor_fee_amount,refund_amount,provider_net_amount,status,payout_reference,payout_minimum,eligible_at,approved_at,processing_at,paid_at,failure_reason,created_at,updated_at")
      .eq("provider_user_id",user.id)
      .order("created_at",{ascending:false})
      .limit(100),
    supabaseAdmin
      .from("service_provider_payout_accounts")
      .select("provider,phone,status,verified_at,rejection_reason")
      .eq("provider_user_id",user.id)
      .eq("provider","mpesa_b2c")
      .maybeSingle(),
    supabaseAdmin
      .from("verification_cases")
      .select("status,verification_level,expires_at")
      .eq("subject_type","provider")
      .eq("subject_id",user.id)
      .order("created_at",{ascending:false})
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("owner_id",user.id)
      .limit(20),
  ]);

  const businessIds=(businesses??[]).map((row:any)=>String(row.id));
  const {data:profiles}=businessIds.length
    ? await supabaseAdmin
        .from("service_profiles")
        .select("id,payout_minimum,payout_schedule")
        .in("business_id",businessIds)
        .limit(20)
    : {data:[] as any[]};

  const rows=payouts??[];
  const appointmentIds=rows.map((row:any)=>String(row.appointment_id)).filter(Boolean);
  const {data:appointments}=appointmentIds.length
    ? await supabaseAdmin
        .from("service_appointments")
        .select("id,public_id,starts_at,status,payment_status,service_offerings(name),service_staff(display_name)")
        .in("id",appointmentIds)
    : {data:[] as any[]};
  const appointmentById=new Map((appointments??[]).map((row:any)=>[String(row.id),row]));

  const paidRows=rows.filter((p:any)=>p.status==="paid");
  const readyRows=rows.filter((p:any)=>["eligible","approved"].includes(p.status));
  const processingRows=rows.filter((p:any)=>p.status==="processing");
  const heldRows=rows.filter((p:any)=>["held","failed"].includes(p.status));
  const refundedRows=rows.filter((p:any)=>Number(p.refund_amount||0)>0);

  const payoutMinimum=Number(
    rows.find((p:any)=>String(p.currency||"").toUpperCase()==="KES")?.payout_minimum
      ?? profiles?.[0]?.payout_minimum
      ?? 1000
  );
  const payoutSchedule=String(profiles?.[0]?.payout_schedule||"weekly");
  const readyKes=readyRows
    .filter((p:any)=>String(p.currency||"KES").toUpperCase()==="KES")
    .reduce((sum:number,p:any)=>sum+Number(p.provider_net_amount||0),0);
  const thresholdPercent=payoutMinimum>0?Math.min(100,Math.round((readyKes/payoutMinimum)*100)):100;
  const verificationReady=verification?.status==="approved"&&(!verification.expires_at||new Date(verification.expires_at)>new Date());

  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <header className="border-b border-black/8 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
        <div><Link href="/" className="text-sm font-semibold">SafariPlug</Link><p className="mt-1 text-[10px] uppercase tracking-[.25em] text-black/35">Partner finance</p></div>
        <div className="flex gap-2"><Link href="/business/services" className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold">Workspace</Link><Link href="/services" className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white">View marketplace</Link></div>
      </div>
    </header>

    <section className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-black/40">Earnings & payouts</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">Know where every shilling stands.</h1>
        <p className="mt-4 text-base leading-7 text-black/50">Completed-service earnings, SafariPlug fees, refunds, payout readiness and M-Pesa payout history in one place.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard dark label="Paid out" value={totalsByCurrency(paidRows)} hint="Confirmed provider payouts" />
        <SummaryCard label="Ready / approved" value={totalsByCurrency(readyRows)} hint="Waiting for finance release" />
        <SummaryCard label="Processing" value={totalsByCurrency(processingRows)} hint="Submitted to M-Pesa" />
        <SummaryCard label="On hold / failed" value={totalsByCurrency(heldRows)} hint="Needs SafariPlug finance review" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-black/40">KES payout threshold</p><h2 className="mt-2 text-2xl font-semibold">{money(readyKes,"KES")} <span className="text-sm font-normal text-black/40">of {money(payoutMinimum,"KES")}</span></h2></div>
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-[11px] font-semibold capitalize">{payoutSchedule} schedule</span>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full bg-black" style={{width:String(thresholdPercent)+"%"}} /></div>
          <div className="mt-3 flex items-center justify-between text-xs text-black/45"><span>{thresholdPercent}% of current threshold</span><span>{readyKes>=payoutMinimum?"Threshold reached":"Keep earning toward payout"}</span></div>
          <p className="mt-4 text-xs leading-5 text-black/45">Only eligible and approved KES earnings count toward this progress. Processing, held, refunded and failed payouts are shown separately.</p>
        </section>

        <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">M-Pesa payout destination</p><p className="mt-1 text-xs text-black/45">Only a SafariPlug-verified destination can receive provider payouts.</p></div><span className="rounded-full bg-black/5 px-3 py-1.5 text-[11px] font-semibold">{account?.status||"not configured"}</span></div>
          <p className="mt-4 text-lg font-semibold">{account?.phone||"Not configured"}</p>
          <p className="mt-1 text-xs text-black/45">{account?.status==="verified"?"Verified for M-Pesa payouts":account?"Awaiting SafariPlug verification":"Add a Kenyan M-Pesa number below"}</p>
          <PayoutDestinationForm phone={account?.phone} status={account?.status}/>
        </section>
      </div>

      <div className={"mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] p-6 "+(verificationReady?"bg-emerald-50":"bg-amber-50")}>
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-black/40">Provider verification</p><p className="mt-2 font-semibold">{verificationReady?"SafariPlug provider review approved":"Payouts remain blocked until the SafariPlug provider review is approved"}</p><p className="mt-1 text-xs text-black/50">Finance also rechecks completed service status, payment truth, refund reviews and your verified payout destination before money is released.</p></div>
        <Link href="/business/verification" className="rounded-xl bg-black px-5 py-3 text-xs font-semibold text-white">{verificationReady?"Review verification":"Request provider review"}</Link>
      </div>

      {refundedRows.length>0&&<div className="mt-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-900/60">Refund adjustments</p><p className="mt-2 text-lg font-semibold">{refundedRows.length} payout record{refundedRows.length===1?"":"s"} include a customer refund adjustment.</p><p className="mt-1 text-sm leading-6 text-black/50">Refunded amounts reduce provider earnings and can place a payout on hold for finance reconciliation.</p></div>}

      <div className="mt-10 overflow-hidden rounded-[1.75rem] bg-white shadow-sm">
        <div className="border-b border-black/8 px-6 py-5"><h2 className="text-lg font-semibold">Earnings & payout history</h2><p className="mt-1 text-xs text-black/45">Each row maps back to the service appointment that generated the earning.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-black/8 text-[10px] uppercase tracking-[.18em] text-black/40"><tr><th className="px-6 py-4">Service</th><th className="px-6 py-4">Appointment</th><th className="px-6 py-4">Gross</th><th className="px-6 py-4">SafariPlug fee</th><th className="px-6 py-4">Refund</th><th className="px-6 py-4">Your net</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">M-Pesa reference</th></tr></thead>
            <tbody className="divide-y divide-black/6">{rows.map((p:any)=>{
              const appointment=appointmentById.get(String(p.appointment_id));
              const offering=Array.isArray(appointment?.service_offerings)?appointment.service_offerings[0]:appointment?.service_offerings;
              const staff=Array.isArray(appointment?.service_staff)?appointment.service_staff[0]:appointment?.service_staff;
              const eventDate=appointment?.starts_at||p.created_at;
              return <tr key={p.id}>
                <td className="px-6 py-5"><p className="font-medium">{offering?.name||"Service appointment"}</p><p className="mt-1 text-xs text-black/40">{staff?.display_name?"with "+staff.display_name:"Provider service"}</p></td>
                <td className="px-6 py-5"><p>{new Intl.DateTimeFormat("en",{dateStyle:"medium"}).format(new Date(eventDate))}</p><p className="mt-1 font-mono text-[11px] text-black/40">{appointment?.public_id||String(p.appointment_id).slice(0,8)}</p></td>
                <td className="px-6 py-5">{money(p.gross_amount,p.currency)}</td>
                <td className="px-6 py-5">{money(p.platform_fee_amount,p.currency)} <span className="text-black/35">({Number(p.platform_fee_percent||0).toLocaleString()}%)</span></td>
                <td className="px-6 py-5">{Number(p.refund_amount||0)>0?<span className="text-amber-700">− {money(p.refund_amount,p.currency)}</span>:"—"}</td>
                <td className="px-6 py-5 font-semibold">{money(p.provider_net_amount,p.currency)}</td>
                <td className="px-6 py-5"><span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-medium">{STATUS[p.status]||p.status}</span>{p.failure_reason&&<p className="mt-2 max-w-xs text-xs leading-5 text-red-600">{p.failure_reason}</p>}{p.status==="processing"&&p.processing_at&&<p className="mt-2 text-[11px] text-black/40">Submitted {new Date(p.processing_at).toLocaleString()}</p>}{p.status==="paid"&&p.paid_at&&<p className="mt-2 text-[11px] text-black/40">Paid {new Date(p.paid_at).toLocaleString()}</p>}</td>
                <td className="px-6 py-5 font-mono text-xs text-black/50">{p.payout_reference||"—"}</td>
              </tr>;
            })}</tbody>
          </table>
          {!rows.length&&<div className="px-6 py-16 text-center text-sm text-black/40">No earnings yet. A completed, fully paid appointment becomes eligible only after SafariPlug’s payout safety checks pass.</div>}
        </div>
      </div>
    </section>
  </main>;
}

function SummaryCard({label,value,hint,dark=false}:{label:string;value:string;hint:string;dark?:boolean}){
  return <div className={"rounded-[1.75rem] p-6 shadow-sm "+(dark?"bg-black text-white":"bg-white")}><p className={"text-[10px] uppercase tracking-[.22em] "+(dark?"text-white/45":"text-black/40")}>{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className={"mt-2 text-xs "+(dark?"text-white/45":"text-black/45")}>{hint}</p></div>;
}
