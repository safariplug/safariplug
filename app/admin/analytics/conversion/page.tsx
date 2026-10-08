import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";

type Surface="hotels"|"activities"|"transfers"|"services"|"restaurants"|"destinations"|"events"|"amani";

export default async function ConversionAnalyticsPage(){
  await requireAdmin();
  const since=new Date(Date.now()-7*24*60*60*1000).toISOString();
  const [events,hotels,activities,transfers,services,food]=await Promise.all([
    supabaseAdmin.from("marketplace_conversion_events").select("event_name,surface,session_id,created_at").gte("created_at",since).limit(10000),
    supabaseAdmin.from("hotel_booking_pricing_ledger").select("id,payment_status,booking_status,created_at").gte("created_at",since),
    supabaseAdmin.from("activity_booking_pricing_ledger").select("id,payment_status,booking_status,created_at").gte("created_at",since),
    supabaseAdmin.from("transfer_booking_pricing_ledger").select("id,payment_status,booking_status,created_at").gte("created_at",since),
    supabaseAdmin.from("service_appointments").select("id,payment_status,status,created_at").gte("created_at",since),
    supabaseAdmin.from("food_orders").select("id,payment_status,status,created_at").gte("created_at",since),
  ]);
  const errors=[events.error,hotels.error,activities.error,transfers.error,services.error,food.error].filter(Boolean);
  if(errors.length) throw errors[0];

  const eventRows=events.data||[];
  const surfaces:Surface[]=["hotels","activities","transfers","services","restaurants","destinations","events","amani"];
  const viewsBySurface=new Map<Surface,number>();
  for(const surface of surfaces){
    const sessions=new Set(eventRows.filter((row:any)=>row.surface===surface&&row.event_name==="marketplace_view").map((row:any)=>String(row.session_id)));
    viewsBySurface.set(surface,sessions.size);
  }

  const funnels=[
    funnel("Hotels",viewsBySurface.get("hotels")||0,hotels.data||[],"booking_status"),
    funnel("Activities",viewsBySurface.get("activities")||0,activities.data||[],"booking_status"),
    funnel("Transfers",viewsBySurface.get("transfers")||0,transfers.data||[],"booking_status"),
    funnel("Services",viewsBySurface.get("services")||0,services.data||[],"status"),
    funnel("Restaurants",viewsBySurface.get("restaurants")||0,food.data||[],"status"),
  ];

  const totalViews=[...viewsBySurface.values()].reduce((a,b)=>a+b,0);
  const totalAttempts=funnels.reduce((s,f)=>s+f.attempts,0);
  const totalPaid=funnels.reduce((s,f)=>s+f.paid,0);
  const totalCompleted=funnels.reduce((s,f)=>s+f.completed,0);

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-7"><div><Link href="/admin" className="text-sm text-amber-400">← Command Center</Link><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Commercial intelligence · 7 days</p><h1 className="mt-2 text-4xl font-semibold">Conversion analytics</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Marketplace views are measured from SafariPlug sessions. Checkout attempts, payment and completion are derived from authoritative booking/order records rather than browser claims.</p></div></div>

    <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Marketplace sessions" value={totalViews}/><Metric label="Commerce attempts" value={totalAttempts}/><Metric label="Paid" value={totalPaid}/><Metric label="Confirmed / completed" value={totalCompleted}/></section>

    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"><div className="border-b border-zinc-800 p-5"><h2 className="text-xl font-semibold">Commerce funnel by product</h2><p className="mt-1 text-xs text-zinc-500">View-to-attempt is directional because one session can browse multiple results and connected supplier inventory has its own live-search steps.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="px-5 py-3">Product</th><th>Views</th><th>Attempts</th><th>Paid</th><th>Confirmed</th><th>View → attempt</th><th>Attempt → paid</th></tr></thead><tbody>{funnels.map(row=><tr key={row.name} className="border-t border-zinc-900"><td className="px-5 py-4 font-semibold">{row.name}</td><td>{row.views}</td><td>{row.attempts}</td><td>{row.paid}</td><td>{row.completed}</td><td>{pct(row.attempts,row.views)}</td><td>{pct(row.paid,row.attempts)}</td></tr>)}</tbody></table></div></section>

    <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{surfaces.map(surface=><div key={surface} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs capitalize text-zinc-500">{surface}</p><p className="mt-2 text-3xl font-bold">{viewsBySurface.get(surface)||0}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">unique sessions / 7d</p></div>)}</section>
  </div></main>
}

function funnel(name:string,views:number,rows:any[],statusKey:string){
  const paid=rows.filter((row:any)=>row.payment_status==="paid").length;
  const completed=rows.filter((row:any)=>["confirmed","completed","delivered"].includes(String(row[statusKey]))).length;
  return{name,views,attempts:rows.length,paid,completed};
}
function pct(num:number,den:number){return den?Math.round(num/den*100)+"%":"—"}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>}
