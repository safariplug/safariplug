import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const EVENTS=new Set(["marketplace_view","product_view","trip_add","checkout_start"]);
const SURFACES=new Set(["hotels","activities","transfers","services","restaurants","destinations","events","amani"]);

export async function POST(request:Request){
  const body=await request.json().catch(()=>null);
  const eventName=String(body?.eventName||"");
  const surface=String(body?.surface||"");
  const sessionId=String(body?.sessionId||"").trim().slice(0,120);
  const productRef=body?.productRef?String(body.productRef).trim().slice(0,200):null;
  const tripId=body?.tripId?String(body.tripId).trim():null;
  if(!EVENTS.has(eventName)||!SURFACES.has(surface)||!sessionId)return NextResponse.json({error:"Invalid analytics event."},{status:400});

  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();

  const {error}=await supabaseAdmin.from("marketplace_conversion_events").insert({
    event_name:eventName,
    surface,
    session_id:sessionId,
    traveler_id:user && !user.is_anonymous ? user.id : null,
    product_ref:productRef,
    trip_id:tripId||null,
    metadata:{pathname:typeof body?.pathname==="string"?body.pathname.slice(0,300):null},
  });
  if(error)return NextResponse.json({error:"Unable to record analytics event."},{status:500});
  return NextResponse.json({ok:true});
}
