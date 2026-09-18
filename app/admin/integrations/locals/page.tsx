import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reviewLocal, setLocalActivation } from "./actions";

export const dynamic = "force-dynamic";

function tone(value: string) {
  if (["active", "verified", "approved"].includes(value)) return "text-emerald-400";
  if (["rejected", "paused", "suspended"].includes(value)) return "text-red-400";
  return "text-amber-400";
}

export default async function AdminLocalsPage() {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("local_profiles").select("id,display_name,personal_photo_url,identity_liveness_verified_at,city,country,languages,interests,hourly_rate,currency,verification_state,service_status,created_at,verification_cases:verification_cases!verification_cases_subject_id_fkey(id,status,verification_level,provider,created_at)").order("created_at", { ascending: false });
  // verification_cases has a polymorphic subject_id, so fall back to separate case lookup when PostgREST cannot infer a relationship.
  let locals = data ?? [];
  if (error) {
    const fallback = await supabaseAdmin.from("local_profiles").select("id,display_name,personal_photo_url,identity_liveness_verified_at,city,country,languages,interests,hourly_rate,currency,verification_state,service_status,created_at").order("created_at", { ascending: false });
    if (fallback.error) throw new Error(fallback.error.message);
    const ids = (fallback.data ?? []).map((row) => row.id);
    const cases = ids.length ? await supabaseAdmin.from("verification_cases").select("id,subject_id,status,verification_level,provider,created_at").eq("subject_type", "local").in("subject_id", ids).order("created_at", { ascending: false }) : { data: [] as any[] };
    locals = (fallback.data ?? []).map((row) => ({ ...row, verification_cases: (cases.data ?? []).filter((item) => item.subject_id === row.id) })) as typeof locals;
  }

  const pending = locals.filter((x: any) => x.verification_state === "pending").length;
  const verified = locals.filter((x: any) => x.verification_state === "verified").length;
  const active = locals.filter((x: any) => x.service_status === "active").length;

  return <main className="min-h-screen bg-[#050505] p-8 text-white"><div className="mx-auto max-w-7xl space-y-8">
    <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">← Command Center</Link>
    <header className="border-b border-zinc-800 pb-6"><p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">Local operations</p><h1 className="mt-2 text-3xl font-extrabold">Identity review & activation</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Identity/liveness decisions from Sumsub and marketplace activation are separate. Staff may activate or pause a Local, but cannot manually manufacture an external identity or live face/liveness approval.</p></header>
    <section className="grid gap-4 sm:grid-cols-3">{[["Pending review",pending],["Verified",verified],["Active",active]].map(([label,n])=><div key={String(label)} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p><p className="mt-2 font-mono text-lg font-bold text-amber-400">{n}</p></div>)}</section>
    <section className="grid gap-5">{locals.map((local:any)=>{const cases=Array.isArray(local.verification_cases)?local.verification_cases:[];const current=cases[0];return <article key={local.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6"><div className="flex flex-col gap-5 md:flex-row"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-zinc-900">{local.personal_photo_url?<img src={local.personal_photo_url} alt={local.display_name} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-xs text-zinc-600">No photo</div>}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{local.display_name}</h2><span className={`text-xs font-bold ${tone(local.verification_state)}`}>{local.verification_state}</span><span className={`text-xs font-bold ${tone(local.service_status)}`}>{local.service_status}</span></div><p className="mt-2 text-sm text-zinc-500">{[local.city,local.country].filter(Boolean).join(", ")||"Location not supplied"}</p><p className="mt-3 text-xs text-zinc-400">Languages: {(local.languages||[]).join(", ")||"none"} · Interests: {(local.interests||[]).join(", ")||"none"}</p><p className="mt-2 text-xs text-zinc-500">Identity case: {current?`${current.status} · ${current.verification_level} · ${current.provider}`:"not submitted"}</p><p className={`mt-1 text-xs font-semibold ${local.identity_liveness_verified_at?"text-emerald-400":"text-amber-400"}`}>{local.identity_liveness_verified_at?"live identity/liveness recorded":"live identity/liveness required"}</p><div className="mt-5 flex flex-wrap gap-3">{current&&["pending","in_review"].includes(current.status)&&current.provider!=="sumsub"?<><form action={reviewLocal}><input type="hidden" name="local_id" value={local.id}/><input type="hidden" name="decision" value="approve"/><button className="rounded-lg border border-emerald-500/40 px-4 py-2 text-xs font-bold text-emerald-300">Approve identity</button></form><form action={reviewLocal} className="flex gap-2"><input type="hidden" name="local_id" value={local.id}/><input type="hidden" name="decision" value="reject"/><input name="reason" placeholder="Rejection reason" className="rounded-lg border border-zinc-700 bg-black px-3 py-2 text-xs"/><button className="rounded-lg border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300">Reject</button></form></>:null}{local.verification_state==="verified"&&local.identity_liveness_verified_at&&local.service_status!=="active"?<form action={setLocalActivation}><input type="hidden" name="local_id" value={local.id}/><input type="hidden" name="activate" value="true"/><button className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black">Activate marketplace profile</button></form>:null}{local.service_status==="active"?<form action={setLocalActivation}><input type="hidden" name="local_id" value={local.id}/><input type="hidden" name="activate" value="false"/><button className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300">Pause profile</button></form>:null}</div></div></div></article>})}{!locals.length?<div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-12 text-center text-zinc-600">No Local applications yet.</div>:null}</section>
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400"><strong className="text-white">Verification boundary:</strong> external Sumsub identity/liveness decisions are provider-managed. SafariPlug staff control marketplace activation separately and cannot manually create a successful external face/liveness result.</div>
  </div></main>;
}
