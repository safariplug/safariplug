import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTravelerVerificationState } from "@/lib/services/traveler-verification";
import { currentCompliance, driverVerificationCurrent } from "@/lib/services/driver-verification";
import { eligibleDriverRequestVehicles, knownDriverRequestCapacity } from "@/lib/services/driver-request-eligibility";

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

export async function POST(request: Request) {
  const user=await getUser(request);
  if(!user)return NextResponse.json({error:"A confirmed SafariPlug account is required."},{status:401});

  const trust=await getTravelerVerificationState(user.id);
  if(!trust.verified){
    return NextResponse.json({
      error:"traveler_verification_required",
      message:"Complete SafariPlug identity and live face verification before requesting a specific driver.",
      verification:trust,
      verificationUrl:"/account/verification",
    },{status:403});
  }

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const driverId=String(body.driverId||"").trim();
  const pickup=String(body.pickup||"").trim();
  const destination=String(body.destination||"").trim();
  const requestedAt=String(body.requestedAt||"").trim();
  const passengers=Math.max(1,Math.min(50,Number(body.passengers||1)));
  const rateId=String(body.rateId||"").trim()||null;
  const tripId=String(body.tripId||"").trim()||null;
  const notes=String(body.notes||"").trim().slice(0,1000)||null;

  if(!driverId||!pickup||!destination||!requestedAt)return NextResponse.json({error:"Driver, pickup, destination and pickup time are required."},{status:400});
  const when=new Date(requestedAt);
  if(Number.isNaN(when.getTime())||when<=new Date())return NextResponse.json({error:"Choose a future pickup time."},{status:400});

  const {data:driver,error:driverError}=await supabaseAdmin
    .from("driver_profiles")
    .select("id,personal_photo_url,identity_liveness_verified_at,verification_state,service_status,driving_license_compliance_status,vehicles(id,status,passenger_capacity,registration_compliance_status,insurance_compliance_status)")
    .eq("id",driverId)
    .maybeSingle();
  if(driverError)return NextResponse.json({error:"Unable to verify driver eligibility."},{status:500});
  if(!driver||driver.service_status!=="active"||driver.verification_state!=="verified"||!driver.personal_photo_url||!currentCompliance(driver.driving_license_compliance_status)||!(await driverVerificationCurrent(driver))){
    return NextResponse.json({error:"This driver is no longer eligible to receive SafariPlug requests."},{status:409});
  }

  const vehicles=eligibleDriverRequestVehicles(driver.vehicles);
  if(!vehicles.length)return NextResponse.json({error:"This driver no longer has an eligible vehicle for SafariPlug requests."},{status:409});
  const knownCapacity=knownDriverRequestCapacity(vehicles);
  if(knownCapacity!==null&&passengers>knownCapacity)return NextResponse.json({error:"This driver's currently eligible vehicle capacity is "+knownCapacity+" passenger"+(knownCapacity===1?"":"s")+"."},{status:409});

  let linkedTripId:string|null=null;
  if(tripId){
    const {data:trip,error:tripError}=await supabaseAdmin.from("trips").select("id").eq("id",tripId).eq("traveler_id",user.id).maybeSingle();
    if(tripError)return NextResponse.json({error:"Unable to verify trip ownership."},{status:500});
    if(!trip)return NextResponse.json({error:"This SafariPlug trip could not be found."},{status:404});
    linkedTripId=trip.id;
  }

  let quotedAmount:number|null=null;
  let currency="KES";
  if(rateId){
    const {data:rate,error:rateError}=await supabaseAdmin
      .from("driver_transfer_rates")
      .select("id,amount,currency,status,driver_id")
      .eq("id",rateId)
      .eq("driver_id",driverId)
      .eq("status","active")
      .maybeSingle();
    if(rateError)return NextResponse.json({error:"Unable to verify transfer rate."},{status:500});
    if(!rate)return NextResponse.json({error:"That transfer rate is no longer available."},{status:409});
    quotedAmount=Number(rate.amount);
    currency=String(rate.currency||"KES");
  }

  const {data:created,error}=await supabaseAdmin
    .from("driver_transfer_requests")
    .insert({
      traveler_id:user.id,
      driver_id:driverId,
      transfer_rate_id:rateId,
      trip_id:linkedTripId,
      pickup_label:pickup,
      destination_label:destination,
      requested_at:when.toISOString(),
      passenger_count:passengers,
      notes,
      quoted_amount:quotedAmount,
      currency,
    })
    .select("id,status,payment_status,quoted_amount,currency,trip_id")
    .single();

  if(error||!created)return NextResponse.json({error:error?.message||"Unable to create driver request."},{status:400});
  return NextResponse.json({request:created},{status:201});
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
