import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import BookingForm from "../BookingForm";
import { isServiceProviderVerified } from "@/lib/services/provider-bookability";
import ReviewReportButton from "./ReviewReportButton";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tripId?: string }> }) {
  const { slug } = await params; const { tripId } = await searchParams;
  const { data:s } = await supabaseAdmin.from("service_profiles").select("id,timezone,booking_notice_minutes,cancellation_policy,businesses!inner(id,name,slug,description,address,phone,whatsapp,website_url,logo_url,cover_image_url,status,owner_id),service_categories(name),service_offerings(id,name,description,duration_minutes,price,currency,status,requires_confirmation)").eq("status","active").eq("booking_status","open").eq("businesses.slug",slug).in("businesses.status",["active","ACTIVE"]).eq("service_offerings.status","active").maybeSingle();
  if(!s) notFound();
  const profile=s as any; const offerings=(profile.service_offerings??[]) as any[]; const business=profile.businesses;
  if(!(await isServiceProviderVerified(business?.owner_id))) notFound();
  const { data:staffRows }=await supabaseAdmin.from("service_staff").select("id,display_name,bio,personal_photo_url,verification_state,identity_liveness_verified_at,user_id").eq("service_profile_id",profile.id).eq("status","active").eq("verification_state","verified").not("user_id","is",null).not("personal_photo_url","is",null);
  const staffIds=(staffRows??[]).map((row:any)=>String(row.id));
  const { data:staffCases }=staffIds.length?await supabaseAdmin.from("verification_cases").select("subject_id,provider,status,expires_at").eq("subject_type","service_staff").in("subject_id",staffIds).eq("status","approved"): {data:[]};
  const approvedByStaff=new Map((staffCases??[]).filter((row:any)=>!row.expires_at||new Date(row.expires_at).getTime()>Date.now()).map((row:any)=>[String(row.subject_id),String(row.provider||"")]));
  const staff=(staffRows??[]).filter((row:any)=>approvedByStaff.get(String(row.id))==="human_review"||Boolean(row.identity_liveness_verified_at));
  const cover=business.cover_image_url||business.logo_url;
  const { data: reviewRows } = await supabaseAdmin
    .from("traveler_reviews")
    .select("id,rating,dimensions,title,body,verified_booking,supplier_response,supplier_responded_at,created_at")
    .eq("business_id", business.id)
    .eq("product_type", "service")
    .eq("moderation_status", "approved")
    .eq("verified_booking", true)
    .order("created_at", { ascending: false })
    .limit(20);
  const reviews = reviewRows || [];
  const reviewIds = reviews.map((review:any)=>String(review.id));
  const { data: reviewMediaRows } = reviewIds.length ? await supabaseAdmin
    .from("traveler_review_media")
    .select("id,review_id,storage_path")
    .in("review_id", reviewIds)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: true }) : { data: [] as any[] };
  const reviewMedia = new Map<string, Array<{id:string;url:string}>>();
  for (const media of reviewMediaRows || []) {
    const { data: signed } = await supabaseAdmin.storage.from("traveler-review-media").createSignedUrl(String(media.storage_path), 1800);
    if (!signed?.signedUrl) continue;
    const list = reviewMedia.get(String(media.review_id)) || [];
    list.push({ id: String(media.id), url: signed.signedUrl });
    reviewMedia.set(String(media.review_id), list);
  }
  const reviewCount = reviews.length;
  const averageRating = reviewCount ? reviews.reduce((sum:any,row:any)=>sum+Number(row.rating||0),0)/reviewCount : null;
  return <main className="min-h-screen bg-[#f7f7f4] text-[#111]">
    <section className="bg-[#111] text-white"><div className="mx-auto max-w-6xl px-6 pb-14 pt-8 sm:px-10"><div className="flex items-center justify-between"><Link href="/services" className="text-xs font-semibold text-white/50 hover:text-white">← All services</Link><span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[#e7c98d]">Booking open</span></div>{cover&&<div className="relative mt-8 aspect-[21/8] overflow-hidden rounded-[2rem] bg-white/5"><img src={cover} alt="" className="h-full w-full object-cover"/></div>}<div className="mt-8 flex flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#c9a86a]">{profile.service_categories?.name??"Services"}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] sm:text-6xl">{business.name}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-white/55">{business.description}</p></div><div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/65"><p>{business.address??"Location available from provider"}</p>{business.website_url&&<a href={business.website_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-[#e7c98d]">Provider website ↗</a>}</div></div></div></section>
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_420px] sm:px-10"><div><div className="mb-8 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.22em] text-black/40">Choose what you need</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Services & prices</h2></div><span className="rounded-full bg-white px-4 py-2 text-xs text-black/45 shadow-sm">{offerings.length} services</span></div><div className="space-y-3">{offerings.map((x:any)=><details key={x.id} className="group rounded-2xl border border-black/8 bg-white p-5 shadow-[0_18px_55px_-45px_rgba(0,0,0,.5)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-5"><div><h3 className="font-semibold">{x.name}</h3><p className="mt-1 text-sm text-black/45">{x.duration_minutes} min · {x.requires_confirmation?"provider confirmation":"confirmation on booking"}</p></div><div className="flex items-center gap-4"><span className="text-sm font-semibold">{x.currency} {Number(x.price).toLocaleString()}</span><span className="text-black/35 transition group-open:rotate-45">＋</span></div></summary><p className="mt-4 max-w-xl text-sm leading-6 text-black/55">{x.description??"Professionally delivered service from this SafariPlug provider."}</p></details>)}</div>
    <div className="mt-10 rounded-[1.75rem] bg-white p-6"><div className="flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">People</p><h2 className="mt-2 text-2xl font-semibold">Choose your specialist</h2></div><span className="text-xs text-black/40">{(staff??[]).length} available</span></div>{(staff??[]).length?<div className="mt-5 grid gap-3 sm:grid-cols-2">{(staff??[]).map((person:any)=><div key={person.id} className="rounded-2xl border border-black/8 p-4"><div className="h-16 w-16 overflow-hidden rounded-full bg-black">{person.personal_photo_url?<img src={person.personal_photo_url} alt={person.display_name} className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">{person.display_name.split(" ").map((x:string)=>x[0]).slice(0,2).join("")}</div>}</div><p className="mt-3 font-semibold">{person.display_name}</p><p className="mt-1 text-sm leading-5 text-black/45">{person.bio??"SafariPlug service specialist"}</p><span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">SafariPlug verified</span></div>)}</div>:<p className="mt-4 text-sm text-black/50">Choose “Any available specialist” when booking and SafariPlug will show the real open slots.</p>}</div>
    <section className="mt-10 rounded-[1.75rem] bg-white p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-black/40">Traveler trust</p><h2 className="mt-2 text-2xl font-semibold">Verified SafariPlug reviews</h2></div>{averageRating!==null?<div className="text-right"><p className="text-3xl font-semibold">{averageRating.toFixed(1)}</p><p className="text-xs text-black/40">{reviewCount} verified review{reviewCount===1?"":"s"}</p></div>:<span className="text-xs text-black/40">No verified reviews yet</span>}</div>{reviews.length?<div className="mt-5 space-y-3">{reviews.slice(0,6).map((review:any)=><article key={review.id} className="rounded-2xl border border-black/8 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold">{"★".repeat(Number(review.rating||0))}<span className="text-black/10">{"★".repeat(5-Number(review.rating||0))}</span></p>{review.title&&<p className="mt-1 font-semibold">{review.title}</p>}</div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-700">Verified booking</span></div>{review.body&&<p className="mt-3 text-sm leading-6 text-black/55">{review.body}</p>}{(reviewMedia.get(String(review.id))||[]).length>0&&<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(reviewMedia.get(String(review.id))||[]).map((media:any)=><div key={media.id} className="aspect-square overflow-hidden rounded-xl bg-black/[.04]"><img src={media.url} alt="Traveler review photo" className="h-full w-full object-cover"/></div>)}</div>}{review.supplier_response&&<div className="mt-3 rounded-xl bg-[#f7f7f4] p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-black/35">Provider response</p><p className="mt-1 text-xs leading-5 text-black/55">{review.supplier_response}</p></div>}<ReviewReportButton reviewId={String(review.id)}/></article>)}</div>:<p className="mt-4 text-sm leading-6 text-black/45">Reviews will appear here only after a traveler completes and reviews a SafariPlug booking.</p>}</section>
    {profile.cancellation_policy&&<div className="mt-6 rounded-[1.5rem] border border-black/8 p-5"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-black/40">Cancellation policy</p><p className="mt-2 text-sm leading-6 text-black/55">{profile.cancellation_policy}</p></div>}</div>
    <aside className="lg:sticky lg:top-6 lg:h-fit"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[.22em] text-black/40">Live booking</p>{tripId&&<div className="mb-3 rounded-xl border border-black/8 bg-white px-4 py-3 text-xs text-black/55">This booking will be added to your SafariPlug journey.</div>}{offerings.length?<BookingForm profileId={profile.id} offerings={offerings} staff={staff??[]} timezone={profile.timezone??"Africa/Nairobi"} tripId={tripId}/>:<div className="rounded-2xl bg-white p-6 text-sm text-black/50">No bookable services are currently listed.</div>}<p className="mt-4 text-center text-xs text-black/40">{profile.booking_notice_minutes?`Bookings require ${Math.ceil(profile.booking_notice_minutes/60)}h notice.`:"Real availability is checked when you book."}</p></aside></section>
  </main>;
}
