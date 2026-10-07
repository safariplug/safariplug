import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TRAVEL_REVIEW_DIMENSIONS, travelReviewEligible, type TravelReviewProduct } from "@/lib/reviews/travel-review-eligibility";

export const dynamic = "force-dynamic";

async function traveler() {
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

function tableFor(product:TravelReviewProduct){
  return product==="hotel"?"hotel_booking_pricing_ledger":product==="activity"?"activity_booking_pricing_ledger":"transfer_booking_pricing_ledger";
}

export async function GET(){
  const user=await traveler();
  if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const {data,error}=await supabaseAdmin.from("traveler_reviews")
    .select("id,product_type,source_id,rating,dimensions,title,body,verified_booking,moderation_status,moderation_note,supplier_response,created_at,updated_at")
    .eq("traveler_id",user.id)
    .in("product_type",["hotel","activity","transfer"])
    .order("created_at",{ascending:false})
    .limit(300);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({reviews:data??[]});
}

export async function POST(request:Request){
  const user=await traveler();
  if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const body=await request.json().catch(()=>null);
  const product=String(body?.product||"") as TravelReviewProduct;
  const sourceId=String(body?.sourceId||"").trim();
  const rating=Number(body?.rating);
  if(!["hotel","activity","transfer"].includes(product))return NextResponse.json({error:"Unsupported review product."},{status:400});
  if(!sourceId)return NextResponse.json({error:"Booking is required."},{status:400});
  if(!Number.isInteger(rating)||rating<1||rating>5)return NextResponse.json({error:"Overall rating must be 1–5."},{status:400});

  const dimensionsRaw=body?.dimensions&&typeof body.dimensions==="object"?body.dimensions:{};
  const allowed=TRAVEL_REVIEW_DIMENSIONS[product];
  const dimensions:Record<string,number>={};
  for(const key of allowed){
    const value=Number(dimensionsRaw[key]);
    if(!Number.isInteger(value)||value<1||value>5)return NextResponse.json({error:`${key} rating must be 1–5.`},{status:400});
    dimensions[key]=value;
  }

  const {data:ledger,error:ledgerError}=await supabaseAdmin.from(tableFor(product))
    .select("id,customer_user_id,payment_status,booking_status,metadata")
    .eq("id",sourceId)
    .eq("customer_user_id",user.id)
    .maybeSingle();
  if(ledgerError)return NextResponse.json({error:ledgerError.message},{status:500});
  if(!ledger)return NextResponse.json({error:"Booking not found."},{status:404});
  const eligibility=travelReviewEligible({
    product,
    bookingStatus:ledger.booking_status,
    paymentStatus:ledger.payment_status,
    metadata:(ledger.metadata||{}) as Record<string,unknown>,
  });
  if(!eligibility.eligible)return NextResponse.json({error:eligibility.reason},{status:409});

  const title=typeof body?.title==="string"?body.title.trim().slice(0,120):"";
  const reviewBody=typeof body?.body==="string"?body.body.trim().slice(0,4000):"";
  const {data:review,error}=await supabaseAdmin.from("traveler_reviews").upsert({
    traveler_id:user.id,
    product_type:product,
    source_id:sourceId,
    business_id:null,
    rating,
    dimensions,
    title:title||null,
    body:reviewBody||null,
    verified_booking:true,
    moderation_status:"pending",
    moderation_note:null,
    moderated_by:null,
    moderated_at:null,
  },{onConflict:"traveler_id,product_type,source_id"})
  .select("id,product_type,source_id,rating,dimensions,title,body,verified_booking,moderation_status,created_at,updated_at")
  .single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({review},{status:201});
}
