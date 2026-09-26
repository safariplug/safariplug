import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getUser(request: Request) {
  const header=request.headers.get("authorization")||"";
  const token=header.startsWith("Bearer ")?header.slice(7).trim():"";
  if(token){
    const {data,error}=await supabaseAdmin.auth.getUser(token);
    if(!error&&data.user&&!data.user.is_anonymous&&(data.user.email_confirmed_at||data.user.phone_confirmed_at))return data.user;
  }
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.is_anonymous||!(user.email_confirmed_at||user.phone_confirmed_at))return null;
  return user;
}

export async function GET(request: Request) {
  const user=await getUser(request);
  if(!user)return NextResponse.json({error:"A confirmed SafariPlug account is required."},{status:401});

  const {data:requests,error}=await supabaseAdmin
    .from("driver_transfer_requests")
    .select("id,driver_id,trip_id,pickup_label,destination_label,requested_at,passenger_count,notes,quoted_amount,currency,status,payment_status,payment_reference,paid_at,created_at")
    .eq("traveler_id",user.id)
    .order("requested_at",{ascending:false})
    .limit(100);
  if(error)return NextResponse.json({error:"Unable to load driver requests."},{status:500});

  const driverIds=[...new Set((requests??[]).map((row:any)=>row.driver_id).filter(Boolean))] as string[];
  const {data:drivers}=driverIds.length
    ? await supabaseAdmin.from("driver_profiles").select("id,display_name,personal_photo_url,service_city,service_country").in("id",driverIds)
    : {data:[] as any[]};
  const driverById=new Map((drivers??[]).map((driver:any)=>[driver.id,driver]));

  return NextResponse.json({
    requests:(requests??[]).map((row:any)=>({...row,driver:driverById.get(row.driver_id)||null}))
  });
}

export async function PATCH(request: Request) {
  const user=await getUser(request);
  if(!user)return NextResponse.json({error:"A confirmed SafariPlug account is required."},{status:401});

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const requestId=String(body.requestId||"").trim();
  const action=String(body.action||"").trim();
  if(!requestId)return NextResponse.json({error:"requestId is required."},{status:400});
  if(action!=="cancel")return NextResponse.json({error:"Unsupported driver request action."},{status:400});

  const {data:owned,error:ownedError}=await supabaseAdmin
    .from("driver_transfer_requests")
    .select("id,status")
    .eq("id",requestId)
    .eq("traveler_id",user.id)
    .maybeSingle();
  if(ownedError)return NextResponse.json({error:"Unable to verify driver request."},{status:500});
  if(!owned)return NextResponse.json({error:"Driver request not found."},{status:404});
  if(owned.status!=="requested")return NextResponse.json({error:"Only a pending driver request can be cancelled."},{status:409});

  const {error}=await supabaseAdmin.rpc("cancel_driver_transfer_request",{p_request_id:requestId});
  if(error)return NextResponse.json({error:error.message==="request_not_cancellable"?"Only a pending driver request can be cancelled.":error.message},{status:409});
  return NextResponse.json({ok:true,status:"cancelled"});
}
