import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url=new URL(request.url);
    const status=url.searchParams.get("status")||"pending";
    let query=supabaseAdmin.from("traveler_reviews")
      .select("id,traveler_id,product_type,source_id,business_id,rating,dimensions,title,body,verified_booking,moderation_status,moderation_note,supplier_response,created_at,updated_at,businesses(name,slug)")
      .order("created_at",{ascending:false})
      .limit(300);
    if(status!=="all"&&status!=="pending"&&status!=="reported")query=query.eq("moderation_status",status);
    const {data,error}=await query;
    if(error)return NextResponse.json({error:error.message},{status:500});
    const reviews=data??[];
    const ids=reviews.map((review:any)=>String(review.id));
    const [{data:mediaRows},{data:reportRows}]=ids.length?await Promise.all([
      supabaseAdmin.from("traveler_review_media").select("id,review_id,storage_path,moderation_status,content_type,created_at").in("review_id",ids),
      supabaseAdmin.from("traveler_review_reports").select("id,review_id,reason,details,status,created_at").in("review_id",ids).eq("status","open"),
    ]):[{data:[]},{data:[]}];
    const mediaByReview=new Map<string,any[]>();
    for(const media of mediaRows||[]){
      const {data:signed}=await supabaseAdmin.storage.from("traveler-review-media").createSignedUrl(String(media.storage_path),900);
      const list=mediaByReview.get(String(media.review_id))||[];
      list.push({...media,url:signed?.signedUrl||null});
      mediaByReview.set(String(media.review_id),list);
    }
    const reportsByReview=new Map<string,any[]>();
    for(const report of reportRows||[]){
      const list=reportsByReview.get(String(report.review_id))||[];
      list.push(report);reportsByReview.set(String(report.review_id),list);
    }
    const enriched=reviews.map((review:any)=>({...review,media:mediaByReview.get(String(review.id))||[],reports:reportsByReview.get(String(review.id))||[]}));
    const filtered=status==="pending"
      ? enriched.filter((review:any)=>review.moderation_status==="pending"||review.media.some((media:any)=>media.moderation_status==="pending")||review.reports.length>0)
      : status==="reported"
        ? enriched.filter((review:any)=>review.moderation_status==="reported"||review.reports.length>0)
        : enriched;
    return NextResponse.json({reviews:filtered});
  } catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to load review moderation queue."},{status:500});
  }
}

export async function POST(request: Request) {
  try {
    const admin=await requireAdmin();
    const body=await request.json().catch(()=>null);
    const reviewId=String(body?.reviewId||"").trim();
    const action=String(body?.action||"").trim();
    const note=typeof body?.note==="string"?body.note.trim().slice(0,2000):"";
    if(!reviewId)return NextResponse.json({error:"Review is required."},{status:400});
    const nextStatus=action==="approve"?"approved":action==="reject"?"rejected":action==="mark_reported"?"reported":null;
    if(!nextStatus)return NextResponse.json({error:"Unsupported moderation action."},{status:400});
    const patch:any={
      moderation_status:nextStatus,
      moderation_note:note||null,
      moderated_by:admin.id,
      moderated_at:new Date().toISOString(),
    };
    if(nextStatus==="reported")patch.reported_at=new Date().toISOString();
    const {data,error}=await supabaseAdmin.from("traveler_reviews")
      .update(patch)
      .eq("id",reviewId)
      .select("id,moderation_status,moderation_note,moderated_at")
      .single();
    if(error)return NextResponse.json({error:error.message},{status:500});
    if(nextStatus==="approved"||nextStatus==="rejected"){
      await supabaseAdmin.from("traveler_review_media")
        .update({moderation_status:nextStatus})
        .eq("review_id",reviewId)
        .eq("moderation_status","pending");
    }
    if(nextStatus==="approved"||nextStatus==="rejected"){
      await supabaseAdmin.from("traveler_review_reports")
        .update({status:"resolved",resolved_at:new Date().toISOString()})
        .eq("review_id",reviewId)
        .eq("status","open");
    }
    return NextResponse.json({review:data});
  } catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to moderate review."},{status:500});
  }
}
