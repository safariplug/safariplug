import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { loadProductionOpsSnapshot } from "@/lib/ops/production-ops";
import LaunchCheckControls from "./LaunchCheckControls";

export const dynamic="force-dynamic";

const LABELS:Record<string,{title:string;detail:string;required:boolean}>={
  public_smoke:{title:"Public production smoke",detail:"Core marketplace, destination, trust/legal and contact surfaces verified on production.",required:true},
  signed_in_traveler_journey:{title:"Signed-in traveler journey",detail:"A real traveler can sign in and move through the production account journey without a blocking error.",required:true},
  booking_visible_in_account:{title:"Booking visible in traveler account",detail:"A real completed production booking is visible in the correct account surface after payment/confirmation.",required:true},
  trip_attachment:{title:"Booking attached to Trip",detail:"A real production booking can be associated to the correct SafariPlug Trip and is visible in itinerary context.",required:true},
  transfer_flow:{title:"Transfer journey",detail:"A real production transfer search/request flow reaches the expected traveler state without inventing availability.",required:false},
  mobile_traveler_journey:{title:"Mobile traveler journey",detail:"The signed-in traveler experience is usable on a real mobile browser/device across discovery, account and booking state.",required:true},
};

export default async function ProductionLaunchControlPage(){
  await requireAdmin();
  const [ops,proofs,checks]=await Promise.all([
    loadProductionOpsSnapshot(),
    supabaseAdmin.from("production_payment_proofs").select("product,source_id,verified_at,payment_reference").order("verified_at",{ascending:false}).limit(200),
    supabaseAdmin.from("production_launch_checks").select("check_key,status,note,verified_at,verified_by").order("check_key"),
  ]);
  if(proofs.error)throw proofs.error;
  if(checks.error)throw checks.error;

  const proofRows=proofs.data||[];
  const proofCount=(product:string)=>proofRows.filter((row:any)=>row.product===product).length;
  const automatic=[
    {key:"ops",title:"No critical production alerts",passed:ops.summary.critical===0,detail:ops.summary.critical===0?"No critical booking/payment alert rules are firing.":ops.summary.critical+" critical alert item(s) need attention.",href:"/admin/operations"},
    {key:"hotel",title:"Real hotel M-Pesa proof",passed:proofCount("hotel")>0,detail:proofCount("hotel")+" verified production proof(s).",href:"/admin/production/payment-proof"},
    {key:"activity",title:"Real activity M-Pesa proof",passed:proofCount("activity")>0,detail:proofCount("activity")+" verified production proof(s).",href:"/admin/production/payment-proof"},
    {key:"service",title:"Real direct-service M-Pesa proof",passed:proofCount("service")>0,detail:proofCount("service")+" verified production proof(s).",href:"/admin/production/payment-proof"},
  ];

  const checkRows=(checks.data||[]) as Array<{check_key:string;status:string;note:string|null;verified_at:string|null;verified_by:string|null}>;
  const requiredManual=checkRows.filter(row=>LABELS[row.check_key]?.required);
  const requiredPassed=requiredManual.filter(row=>row.status==="passed").length;
  const automaticPassed=automatic.filter(row=>row.passed).length;
  const requiredTotal=automatic.length+requiredManual.length;
  const passedTotal=automaticPassed+requiredPassed;
  const percent=requiredTotal?Math.round(passedTotal/requiredTotal*100):0;
  const launchReady=passedTotal===requiredTotal;

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <header className="border-b border-zinc-800 pb-7"><div className="flex flex-wrap items-end justify-between gap-5"><div><Link href="/admin" className="text-sm text-amber-400">← Command Center</Link><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Launch control</p><h1 className="mt-2 text-4xl font-semibold">Production readiness gate</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">One place to close SafariPlug launch proof using live operational state, verified M-Pesa evidence and explicit human attestation for browser/device journeys that cannot be safely inferred from backend records.</p></div><div className={"rounded-2xl border px-6 py-5 text-right "+(launchReady?"border-emerald-800 bg-emerald-950/20":"border-zinc-800 bg-zinc-950")}><p className="text-xs uppercase tracking-wide text-zinc-500">Required gates</p><p className={"mt-1 text-4xl font-bold "+(launchReady?"text-emerald-300":"text-white")}>{percent}%</p><p className="mt-1 text-xs text-zinc-500">{passedTotal}/{requiredTotal} passed</p></div></div></header>

    <section className={"mt-7 rounded-2xl border p-5 "+(launchReady?"border-emerald-800 bg-emerald-950/20":"border-amber-900/50 bg-amber-950/10")}><p className={"font-semibold "+(launchReady?"text-emerald-300":"text-amber-200")}>{launchReady?"Required launch gates are complete.":"SafariPlug still has open production launch gates."}</p><p className="mt-2 text-sm leading-6 text-zinc-400">{launchReady?"Keep the Operations Center healthy and treat new critical alerts as a launch-regression signal.":"Do not mark SafariPlug launch-ready from code alone. Close the remaining real transaction/browser evidence below."}</p></section>

    <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-zinc-500">Automatic evidence</p><h2 className="mt-1 text-2xl font-semibold">Live system gates</h2></div></div><div className="mt-4 grid gap-4 md:grid-cols-2">{automatic.map(item=><Link key={item.key} href={item.href} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-amber-500/40"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{item.detail}</p></div><span className={"rounded-full px-3 py-1 text-[10px] font-bold uppercase "+(item.passed?"bg-emerald-400/10 text-emerald-300":"bg-red-400/10 text-red-300")}>{item.passed?"passed":"open"}</span></div></Link>)}</div></section>

    <section className="mt-8"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-zinc-500">Human-verified production journeys</p><h2 className="mt-1 text-2xl font-semibold">Browser and device evidence</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">These checks require someone to actually perform the production journey. Passing a check is an admin attestation, not an automated guess.</p></div><div className="mt-4 space-y-3">{checkRows.map(row=>{const meta=LABELS[row.check_key]||{title:row.check_key,detail:"Production verification check.",required:false};return <article key={row.check_key} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-3xl"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{meta.title}</h3>{meta.required?<span className="rounded-full bg-amber-400/10 px-2 py-1 text-[9px] font-bold uppercase text-amber-300">required</span>:<span className="rounded-full bg-zinc-800 px-2 py-1 text-[9px] font-bold uppercase text-zinc-400">recommended</span>}<span className={"rounded-full px-2 py-1 text-[9px] font-bold uppercase "+(row.status==="passed"?"bg-emerald-400/10 text-emerald-300":row.status==="failed"?"bg-red-400/10 text-red-300":"bg-zinc-800 text-zinc-400")}>{row.status}</span></div><p className="mt-2 text-sm leading-6 text-zinc-500">{meta.detail}</p>{row.note&&<p className="mt-2 text-xs text-zinc-400">Note: {row.note}</p>}{row.verified_at&&<p className="mt-1 text-[10px] text-zinc-600">Last verified {new Date(row.verified_at).toLocaleString()}</p>}</div><LaunchCheckControls checkKey={row.check_key} status={row.status}/></div></article>})}</div></section>

    <section className="mt-8 grid gap-4 md:grid-cols-3"><Link href="/admin/operations" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-wide text-zinc-500">Health</p><h3 className="mt-2 font-semibold">Production Operations</h3><p className="mt-2 text-sm text-zinc-500">Resolve failed or stale payment and booking states.</p></Link><Link href="/admin/production/payment-proof" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-wide text-zinc-500">Payments</p><h3 className="mt-2 font-semibold">M-Pesa Proof</h3><p className="mt-2 text-sm text-zinc-500">Attest real paid and confirmed production records.</p></Link><Link href="/admin/analytics/conversion" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs uppercase tracking-wide text-zinc-500">Commercial</p><h3 className="mt-2 font-semibold">Conversion Analytics</h3><p className="mt-2 text-sm text-zinc-500">Watch what real traveler traffic does after launch.</p></Link></section>
  </div></main>;
}
