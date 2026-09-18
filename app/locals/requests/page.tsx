import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function badge(status: string) {
  if (status === "accepted" || status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "declined" || status === "cancelled") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export default async function LocalRequestsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/account/login?next=/locals/requests");
  const { data: profile } = await db.from("local_profiles").select("id,display_name,verification_state,service_status").eq("user_id", user.id).maybeSingle();
  if (!profile) redirect("/locals/onboarding");
  const { data: requests, error } = await db.from("local_requests").select("id,traveler_id,trip_id,requested_start_at,requested_end_at,city,activity,notes,quoted_amount,currency,status,created_at").eq("local_id", profile.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  async function respond(formData: FormData) { "use server";
    const client = await createClient();
    const { data: { user: current } } = await client.auth.getUser();
    if (!current) redirect("/account/login?next=/locals/requests");
    const requestId=String(formData.get("request_id")||"");
    const decision=String(formData.get("decision")||"");
    if(!requestId || !["accepted","declined"].includes(decision)) throw new Error("Invalid response.");
    const { data: own }=await client.from("local_profiles").select("id,verification_state,identity_liveness_verified_at,service_status").eq("user_id",current.id).maybeSingle();
    if(!own) throw new Error("Local profile not found.");
    if(decision==="accepted" && (own.verification_state!=="verified" || !own.identity_liveness_verified_at || own.service_status!=="active")) throw new Error("Only externally identity/liveness-verified active Locals can accept requests.");
    const { data: request }=await client.from("local_requests").select("id,status").eq("id",requestId).eq("local_id",own.id).maybeSingle();
    if(!request || request.status!=="requested") throw new Error("This request can no longer be changed.");
    const { error:updateError }=await client.from("local_requests").update({status:decision}).eq("id",requestId).eq("local_id",own.id).eq("status","requested");
    if(updateError) throw new Error(updateError.message);
    revalidatePath("/locals/requests"); revalidatePath("/account/trips");
  }

  return <main className="min-h-screen bg-[#f7f7f4] px-6 py-10 text-black"><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/locals/onboarding" className="text-sm font-semibold">← Local profile</Link><Link href="/locals" className="text-sm font-semibold">Public marketplace →</Link></div><p className="mt-8 text-[11px] font-bold uppercase tracking-[.2em] text-black/40">Local workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Traveler requests</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">Review real requests sent to {profile.display_name}. Accepting confirms your response to the request; it does not create a payment or falsely claim a paid booking.</p><div className="mt-7 grid gap-4">{(requests??[]).map((request)=><article key={request.id} className="rounded-[1.75rem] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold">{request.activity||"Local companion request"}</p><p className="mt-1 text-sm text-black/45">{request.city||"Location to confirm"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(request.status)}`}>{request.status}</span></div><div className="mt-5 grid gap-2 text-sm text-black/60 sm:grid-cols-2"><p><b>Start:</b> {new Date(request.requested_start_at).toLocaleString()}</p><p><b>End:</b> {request.requested_end_at?new Date(request.requested_end_at).toLocaleString():"Not specified"}</p></div>{request.notes?<p className="mt-4 rounded-2xl bg-[#f7f7f4] p-4 text-sm leading-6 text-black/60">{request.notes}</p>:null}{request.status==="requested"?<div className="mt-5 flex gap-3"><form action={respond}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="accepted"/><button disabled={profile.verification_state!=="verified"||profile.service_status!=="active"} className="rounded-full bg-black px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-black/20">Accept request</button></form><form action={respond}><input type="hidden" name="request_id" value={request.id}/><input type="hidden" name="decision" value="declined"/><button className="rounded-full border border-black/15 px-5 py-3 text-xs font-bold">Decline</button></form></div>:null}</article>)}{!(requests??[]).length?<div className="rounded-[1.75rem] bg-white p-10 text-center text-sm text-black/45">No traveler requests yet.</div>:null}</div><div className="mt-6 rounded-2xl border border-black/10 p-4 text-xs leading-5 text-black/50"><b>Safety:</b> only the Local who owns this profile can respond. A request may be accepted only while the Local remains verified and active.</div></div></main>;
}
