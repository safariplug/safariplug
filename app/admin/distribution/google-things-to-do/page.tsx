import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { googleTtdReadiness } from "@/lib/distribution/google-things-to-do-readiness";

export const dynamic = "force-dynamic";

export default async function GoogleThingsToDoReadinessPage() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("service_profiles")
    .select("id,status,booking_status,businesses!inner(id,name,slug,description,address,latitude,longitude,phone,status),service_categories(name),service_offerings!inner(id,name,description,duration_minutes,price,currency,status)")
    .limit(2000);

  const candidates = error ? [] : (data || []).flatMap((profile: any) => {
    const business = profile.businesses;
    const category = profile.service_categories?.name || "";
    const offerings = Array.isArray(profile.service_offerings) ? profile.service_offerings : profile.service_offerings ? [profile.service_offerings] : [];
    return offerings.map((offering: any) => googleTtdReadiness({
      profileId: String(profile.id),
      offeringId: String(offering.id),
      category: String(category),
      businessName: String(business?.name || ""),
      businessSlug: business?.slug || null,
      description: business?.description || null,
      address: business?.address || null,
      latitude: business?.latitude == null ? null : Number(business.latitude),
      longitude: business?.longitude == null ? null : Number(business.longitude),
      phone: business?.phone || null,
      offeringName: String(offering.name || ""),
      offeringDescription: offering.description || null,
      durationMinutes: offering.duration_minutes == null ? null : Number(offering.duration_minutes),
      price: offering.price == null ? null : Number(offering.price),
      currency: offering.currency || null,
      businessStatus: business?.status || null,
      profileStatus: profile.status || null,
      bookingStatus: profile.booking_status || null,
      offeringStatus: offering.status || null,
    }));
  });

  const eligible = candidates.filter((item) => item.eligible);
  const blocked = candidates.filter((item) => !item.eligible);

  return <main className="min-h-screen bg-[#070707] px-5 py-10 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-7">
        <div>
          <Link href="/admin" className="text-sm text-amber-400">← Command Center</Link>
          <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Distribution readiness</p>
          <h1 className="mt-2 text-4xl font-semibold">Google Things to do preflight</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">Checks direct SafariPlug experience-style inventory against the product data SafariPlug must have before a Google Actions Center Things to do integration can be prepared.</p>
        </div>
        <a href="/api/admin/distribution/google-things-to-do" target="_blank" rel="noreferrer" className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black">Open JSON manifest ↗</a>
      </div>

      {error && <div className="mt-6 rounded-2xl border border-red-900 bg-red-950/20 p-4 text-sm text-red-300">Inventory query failed: {error.message}</div>}

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <Metric label="Candidates" value={candidates.length}/>
        <Metric label="Preflight eligible" value={eligible.length}/>
        <Metric label="Blocked / incomplete" value={blocked.length} alert={blocked.length>0}/>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900/50 bg-amber-950/15 p-5">
        <p className="text-sm font-semibold text-amber-200">Important</p>
        <p className="mt-2 text-sm leading-6 text-amber-200/70">This is an internal readiness layer, not a certified Google feed. Google Business Profile naming, feed enrollment, price-policy checks, image requirements, and partner onboarding still need to be completed before submission.</p>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <Panel title="Eligible for feed engineering" count={eligible.length}>
          {eligible.length ? eligible.slice(0,30).map((item)=><article key={item.id} className="border-t border-zinc-900 py-4">
            <div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{item.product.title}</p><p className="mt-1 text-xs text-zinc-500">{item.product.operator.name}</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">preflight eligible</span></div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">{item.product.option.price&&<span>{item.product.option.price.currencyCode} {item.product.option.price.units.toLocaleString()}</span>}{item.product.option.durationSec&&<span>· {Math.round(item.product.option.durationSec/60)} min</span>}{item.product.location.description&&<span>· {item.product.location.description}</span>}</div>
            {item.warnings.length>0&&<p className="mt-2 text-xs leading-5 text-amber-300/70">{item.warnings[0]}</p>}
          </article>) : <Empty text="No direct SafariPlug experience inventory passes preflight yet."/>}
        </Panel>

        <Panel title="Needs supplier/content work" count={blocked.length}>
          {blocked.length ? blocked.slice(0,30).map((item)=><article key={item.id} className="border-t border-zinc-900 py-4">
            <p className="font-semibold">{item.product.title || "Untitled offering"}</p>
            <p className="mt-1 text-xs text-zinc-500">{item.product.operator.name || "Operator missing"}</p>
            <div className="mt-3 space-y-1">{item.blockers.slice(0,4).map((blocker: string)=><p key={blocker} className="text-xs leading-5 text-red-300/80">• {blocker}</p>)}</div>
          </article>) : <Empty text="No blocked candidates."/>}
        </Panel>
      </section>
    </div>
  </main>;
}

function Metric({label,value,alert=false}:{label:string;value:number;alert?:boolean}){return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="text-xs text-zinc-500">{label}</p><p className={"mt-2 text-3xl font-bold "+(alert&&value>0?"text-amber-300":"text-white")}>{value}</p></div>}
function Panel({title,count,children}:{title:string;count:number;children:React.ReactNode}){return <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400">{count}</span></div>{children}</section>}
function Empty({text}:{text:string}){return <p className="border-t border-zinc-900 py-5 text-sm text-zinc-500">{text}</p>}
