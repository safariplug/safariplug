import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import VerifyPaymentProofButton from "./VerifyPaymentProofButton";

export const dynamic="force-dynamic";

type Product="hotel"|"activity"|"transfer"|"service";
type Candidate={product:Product;id:string;paymentProvider:string;paymentReference:string;currency:string;amount:number;bookingStatus:string;paidAt:string;createdAt:string};

export default async function ProductionPaymentProofPage(){
  await requireAdmin();
  const since=new Date(Date.now()-45*24*60*60*1000).toISOString();
  const [hotels,activities,transfers,services,proofs]=await Promise.all([
    supabaseAdmin.from("hotel_booking_pricing_ledger").select("id,payment_provider,payment_reference,payment_status,booking_status,paid_at,customer_currency,currency,customer_retail_amount,retail_amount,created_at").eq("payment_status","paid").eq("booking_status","confirmed").not("payment_reference","is",null).gte("created_at",since).order("created_at",{ascending:false}).limit(100),
    supabaseAdmin.from("activity_booking_pricing_ledger").select("id,payment_provider,payment_reference,payment_status,booking_status,paid_at,customer_currency,retail_amount,created_at").eq("payment_status","paid").eq("booking_status","confirmed").not("payment_reference","is",null).gte("created_at",since).order("created_at",{ascending:false}).limit(100),
    supabaseAdmin.from("transfer_booking_pricing_ledger").select("id,payment_provider,payment_reference,payment_status,booking_status,paid_at,customer_currency,retail_amount,created_at").eq("payment_status","paid").eq("booking_status","confirmed").not("payment_reference","is",null).gte("created_at",since).order("created_at",{ascending:false}).limit(100),
    supabaseAdmin.from("service_appointments").select("id,payment_reference,payment_status,status,paid_at,currency,customer_total_amount,price,created_at").eq("payment_status","paid").not("payment_reference","is",null).in("status",["confirmed","checked_in","in_progress","completed"]).gte("created_at",since).order("created_at",{ascending:false}).limit(100),
    supabaseAdmin.from("production_payment_proofs").select("id,product,source_id,payment_provider,payment_reference,currency,amount,booking_status,verified_at,notes,verified_by").order("verified_at",{ascending:false}).limit(200),
  ]);
  const errors=[hotels.error,activities.error,transfers.error,services.error,proofs.error].filter(Boolean);
  if(errors.length) throw errors[0];

  const candidates:Candidate[]=[
    ...(hotels.data||[]).map((r:any)=>({product:"hotel" as const,id:r.id,paymentProvider:String(r.payment_provider||"unknown"),paymentReference:String(r.payment_reference||""),currency:String(r.customer_currency||r.currency||"KES"),amount:Number(r.customer_retail_amount??r.retail_amount??0),bookingStatus:String(r.booking_status),paidAt:String(r.paid_at||""),createdAt:String(r.created_at)})),
    ...(activities.data||[]).map((r:any)=>({product:"activity" as const,id:r.id,paymentProvider:String(r.payment_provider||"unknown"),paymentReference:String(r.payment_reference||""),currency:String(r.customer_currency||"KES"),amount:Number(r.retail_amount||0),bookingStatus:String(r.booking_status),paidAt:String(r.paid_at||""),createdAt:String(r.created_at)})),
    ...(transfers.data||[]).map((r:any)=>({product:"transfer" as const,id:r.id,paymentProvider:String(r.payment_provider||"unknown"),paymentReference:String(r.payment_reference||""),currency:String(r.customer_currency||"KES"),amount:Number(r.retail_amount||0),bookingStatus:String(r.booking_status),paidAt:String(r.paid_at||""),createdAt:String(r.created_at)})),
    ...(services.data||[]).map((r:any)=>({product:"service" as const,id:r.id,paymentProvider:"mpesa",paymentReference:String(r.payment_reference||""),currency:String(r.currency||"KES"),amount:Number(r.customer_total_amount??r.price??0),bookingStatus:String(r.status),paidAt:String(r.paid_at||""),createdAt:String(r.created_at)})),
  ].filter((row)=>row.paymentProvider==="mpesa"&&row.paymentReference&&row.paidAt);

  const proofRows=proofs.data||[];
  const proofKey=new Set(proofRows.map((p:any)=>String(p.product)+":"+String(p.source_id)));
  const pending=candidates.filter(row=>!proofKey.has(row.product+":"+row.id));

  const byProduct=(product:Product)=>proofRows.filter((p:any)=>p.product===product).length;

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-7"><div><Link href="/admin" className="text-sm text-amber-400">← Command Center</Link><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Launch proof</p><h1 className="mt-2 text-4xl font-semibold">Production payment verification</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">This workspace does not create a payment. It lets an admin attest a real production record only after SafariPlug already has paid-state, provider reference and confirmed/active booking evidence.</p></div></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Hotel proofs" value={byProduct("hotel")}/><Metric label="Activity proofs" value={byProduct("activity")}/><Metric label="Transfer proofs" value={byProduct("transfer")}/><Metric label="Service proofs" value={byProduct("service")}/><Metric label="Eligible unverified" value={pending.length} tone={pending.length?"warning":"ok"}/></section>

    <section className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/15 p-5"><p className="text-sm font-semibold text-amber-200">What counts as proof</p><p className="mt-2 text-sm leading-6 text-amber-200/70">A verified proof is an existing production M-Pesa record with payment status paid, a provider payment reference, paid_at evidence, and either a confirmed supplier booking (hotel/activity/transfer) or a paid active/completed direct service appointment. Clicking verify records an admin attestation; it does not simulate a transaction.</p></section>

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Eligible records awaiting admin proof</h2><p className="mt-1 text-xs text-zinc-500">Newest first · last 45 days</p></div><span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">{pending.length}</span></div><div className="mt-4 space-y-3">{pending.slice(0,50).map(row=><article key={row.product+row.id} className="rounded-xl border border-zinc-800 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{row.product} · {row.paymentProvider}</p><p className="mt-1 font-semibold">{row.currency} {row.amount.toLocaleString()}</p><p className="mt-1 font-mono text-[10px] text-zinc-600">{row.id}</p><p className="mt-2 text-xs text-zinc-400">Payment ref: {row.paymentReference} · {row.bookingStatus} · paid {new Date(row.paidAt).toLocaleString()}</p></div><VerifyPaymentProofButton product={row.product} sourceId={row.id}/></div></article>)}{!pending.length&&<p className="py-8 text-center text-sm text-zinc-500">No eligible unverified M-Pesa records in the last 45 days.</p>}</div></section>

    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><h2 className="text-xl font-semibold">Verified production proofs</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="py-3">Product</th><th>Amount</th><th>Status</th><th>Payment reference</th><th>Verified</th><th>Note</th></tr></thead><tbody>{proofRows.map((p:any)=><tr key={p.id} className="border-t border-zinc-900"><td className="py-4 font-semibold capitalize">{p.product}</td><td>{p.currency} {Number(p.amount).toLocaleString()}</td><td>{p.booking_status}</td><td className="font-mono text-xs">{p.payment_reference}</td><td>{new Date(p.verified_at).toLocaleString()}</td><td className="max-w-xs text-xs text-zinc-500">{p.notes||"—"}</td></tr>)}</tbody></table></div></section>
  </div></main>
}
function Metric({label,value,tone="normal"}:{label:string;value:number;tone?:"normal"|"warning"|"ok"}){const cls=tone==="warning"?"text-amber-300":tone==="ok"?"text-emerald-300":"text-white";return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className={"mt-2 text-3xl font-bold "+cls}>{value}</p></div>}
