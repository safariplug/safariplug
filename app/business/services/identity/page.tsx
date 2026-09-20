import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSupplierOwnedBusiness } from "@/lib/suppliers/readiness";
import StaffVerificationLink from "./StaffVerificationLink";
import StaffPhotoUpload from "./StaffPhotoUpload";

export const dynamic = "force-dynamic";

async function ownerContext() {
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.is_anonymous||!(user.email_confirmed_at||user.phone_confirmed_at)) redirect("/login?next=/business/services/identity");
  const { business } = await getSupplierOwnedBusiness(user.id);
  if(!business) redirect("/business/services");
  const {data:profile}=await supabaseAdmin.from("service_profiles").select("id").eq("business_id",business.id).maybeSingle();
  if(!profile) redirect("/business/services");
  return {user,business,profile};
}


export default async function ServiceIdentityPage({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}) {
  const {business,profile}=await ownerContext(); const params=await searchParams;
  const {data:staff}=await supabaseAdmin.from("service_staff").select("id,display_name,bio,personal_photo_url,user_id,status,verification_state,identity_liveness_verified_at").eq("service_profile_id",profile.id).order("created_at");
  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]"><section className="mx-auto max-w-4xl px-6 py-12 sm:px-10"><Link href="/business/services" className="text-sm font-semibold text-black/55">← Partner workspace</Link><p className="mt-10 text-[11px] font-semibold uppercase tracking-[.25em] text-black/35">Provider identity foundation</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">People behind {business.name}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-black/55">Every specific bookable specialist needs a personal photo, their own linked SafariPlug account, and approved external identity + live face/liveness verification. The business-owner verification does not automatically verify every team member.</p>{params.saved&&<div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Personal photo saved.</div>}{params.error&&<div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">Unable to save that photo. Upload an image for a team member you own.</div>}<div className="mt-8 space-y-4">{(staff??[]).map(person=><div key={person.id} className="rounded-[1.5rem] border border-black/8 bg-white p-5"><div className="flex gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/[.05]">{person.personal_photo_url?<img src={person.personal_photo_url} alt={person.display_name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase text-black/30">No photo</div>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{person.display_name}</h2><span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase ${person.personal_photo_url?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{person.identity_liveness_verified_at?"Identity + liveness verified":person.personal_photo_url?"Photo ready":"Photo required"}</span></div><p className="mt-1 text-xs text-black/45">{person.status} · {person.verification_state.replaceAll("_"," ")}</p><StaffPhotoUpload staffId={person.id} hasPhoto={Boolean(person.personal_photo_url)}/><StaffVerificationLink staffId={person.id} linked={Boolean(person.user_id)} verified={person.verification_state==="verified"&&Boolean(person.identity_liveness_verified_at)}/></div></div></div>)}{!staff?.length&&<div className="rounded-[1.5rem] border border-dashed border-black/15 bg-white p-8 text-center"><p className="font-semibold">No team members yet.</p><p className="mt-2 text-sm text-black/50">Add your service provider in the Team section first, then return here to add the required personal photo.</p></div>}</div><div className="mt-8 rounded-[1.5rem] bg-[#111] p-6 text-white"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-white/40">Next trust layer</p><h2 className="mt-2 text-xl font-semibold">Each specialist verifies themselves.</h2><p className="mt-2 text-sm leading-6 text-white/55">Create a secure claim link for each team member. SafariPlug does not send it automatically. After the specialist links their own account, they complete the real identity + live face/liveness flow before becoming bookable.</p><Link href="/business/verification" className="mt-4 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">Open verification center →</Link></div></section></main>;
}
