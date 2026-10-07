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
    if(status!=="all")query=query.eq("moderation_status",status);
    const {data,error}=await query;
    if(error)return NextResponse.json({error:error.message},{status:500});
    return NextResponse.json({reviews:data??[]});
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
    return NextResponse.json({review:data});
  } catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to moderate review."},{status:500});
  }
}
