import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function currentUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}
async function ownedBusiness(userId: string, businessId?: string) {
  let q = supabaseAdmin.from("businesses").select("id,name,slug,status,verified,claimed,owner_id").eq("owner_id", userId).in("status", ["active", "ACTIVE"]);
  if (businessId) q = q.eq("id", businessId);
  return (await q.order("created_at", { ascending: true }).limit(1).maybeSingle()).data;
}
async function ownedProfile(userId: string, profileId?: string) {
  const business = await ownedBusiness(userId); if (!business) return null;
  let q = supabaseAdmin.from("service_profiles").select("id,business_id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days").eq("business_id", business.id);
  if (profileId) q = q.eq("id", profileId);
  const { data } = await q.maybeSingle();
  return data ? { ...data, business } : null;
}
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    const body = await request.json(); const action = String(body.action || "");

    if (action === "create_business") {
      if (!body.name || !body.businessType || !body.phone) return NextResponse.json({ error: "Business name, type and phone are required." }, { status: 400 });
      const existing = await ownedBusiness(user.id); if (existing) return NextResponse.json({ business: existing });
      const base = slugify(body.name) || `partner-${Date.now()}`;
      const { data, error } = await supabaseAdmin.from("businesses").insert({ owner_id:user.id, name:String(body.name).trim(), slug:`${base}-${Date.now().toString(36)}`, business_type:String(body.businessType).trim(), phone:String(body.phone).trim(), whatsapp:body.whatsapp || body.phone, email:user.email, status:"active", verified:false, claimed:true }).select("id,name,slug,status,verified,claimed").single();
      if (error) return NextResponse.json({ error:error.message }, { status:400 }); return NextResponse.json({ business:data }, { status:201 });
    }

    if (action === "create_profile") {
      const business = await ownedBusiness(user.id, body.businessId); if (!business) return NextResponse.json({ error:"Business not found." }, { status:404 });
      const existing = await supabaseAdmin.from("service_profiles").select("id").eq("business_id", business.id).maybeSingle(); if (existing.data) return NextResponse.json({ error:"A service profile already exists for this business." }, { status:409 });
      const { data: category } = await supabaseAdmin.from("service_categories").select("id").eq("slug", String(body.categorySlug || "")).eq("status","active").maybeSingle(); if (!category) return NextResponse.json({ error:"Choose a valid service category." }, { status:400 });
      const { data, error } = await supabaseAdmin.from("service_profiles").insert({ business_id:business.id, category_id:category.id, status:"active", booking_status:"closed", timezone:body.timezone || "Africa/Nairobi", cancellation_policy:body.cancellationPolicy || null, booking_notice_minutes:Math.max(0, Number(body.bookingNoticeMinutes ?? 60)), max_booking_days:Math.max(1, Number(body.maxBookingDays ?? 90)) }).select("id,business_id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days").single();
      if (error) return NextResponse.json({ error:error.message }, { status:400 }); return NextResponse.json({ profile:data }, { status:201 });
    }

    const profile = await ownedProfile(user.id, body.serviceProfileId); if (!profile) return NextResponse.json({ error:"Service profile not found." }, { status:404 });

    if (action === "update_profile") {
      const patch:any = {}; if (body.timezone) patch.timezone=String(body.timezone); if (body.cancellationPolicy!==undefined) patch.cancellation_policy=body.cancellationPolicy||null; if (body.bookingNoticeMinutes!==undefined) patch.booking_notice_minutes=Math.max(0,Number(body.bookingNoticeMinutes)); if (body.maxBookingDays!==undefined) patch.max_booking_days=Math.max(1,Number(body.maxBookingDays));
      const { data,error } = await supabaseAdmin.from("service_profiles").update(patch).eq("id",profile.id).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({profile:data});
    }
    if (action === "toggle_booking") {
      const open=Boolean(body.open); const {data,error}=await supabaseAdmin.from("service_profiles").update({booking_status:open?"open":"closed",status:"active"}).eq("id",profile.id).select("id,status,booking_status").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({profile:data});
    }
    if (action === "create_offering") {
      if (!body.name || !body.durationMinutes) return NextResponse.json({error:"Service name and duration are required."},{status:400});
      const {data,error}=await supabaseAdmin.from("service_offerings").insert({service_profile_id:profile.id,category_id:profile.category_id,name:String(body.name).trim(),slug:slugify(String(body.name)),description:body.description||null,duration_minutes:Number(body.durationMinutes),price:Number(body.price??0),currency:body.currency||"KES",status:body.active===false?"draft":"active",requires_confirmation:Boolean(body.requiresConfirmation)}).select("id,name,description,duration_minutes,price,currency,status,requires_confirmation").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({offering:data},{status:201});
    }
    if (action === "update_offering") {
      if(!body.offeringId)return NextResponse.json({error:"Offering is required."},{status:400}); const {data:offering}=await supabaseAdmin.from("service_offerings").select("id").eq("id",body.offeringId).eq("service_profile_id",profile.id).maybeSingle(); if(!offering)return NextResponse.json({error:"Offering not found."},{status:404}); const patch:any={}; for(const [key,value] of [["name",body.name],["description",body.description],["duration_minutes",body.durationMinutes],["price",body.price],["currency",body.currency],["status",body.status],["requires_confirmation",body.requiresConfirmation]] as const)if(value!==undefined)patch[key]=value; const {data,error}=await supabaseAdmin.from("service_offerings").update(patch).eq("id",body.offeringId).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({offering:data});
    }
    if (action === "create_staff") {
      if(!body.displayName)return NextResponse.json({error:"Team member name is required."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff").insert({service_profile_id:profile.id,display_name:String(body.displayName).trim(),bio:body.bio||null,status:"active"}).select("id,display_name,bio,status").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({staff:data},{status:201});
    }
    if (action === "assign_staff") {
      const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",body.staffId).eq("service_profile_id",profile.id).maybeSingle(); const {data:offering}=await supabaseAdmin.from("service_offerings").select("id").eq("id",body.offeringId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff||!offering)return NextResponse.json({error:"Staff member or service not found."},{status:404}); const {error}=await supabaseAdmin.from("service_staff_offerings").upsert({staff_id:staff.id,offering_id:offering.id}); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
    }
    if (action === "set_availability") {
      const staffId=String(body.staffId||""); const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",staffId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff)return NextResponse.json({error:"Staff member not found."},{status:404}); const day=Number(body.dayOfWeek),start=String(body.startTime||""),end=String(body.endTime||""); if(!Number.isInteger(day)||day<0||day>6||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return NextResponse.json({error:"Invalid schedule."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff_availability").upsert({staff_id:staffId,day_of_week:day,start_time:start,end_time:end,is_active:true},{onConflict:"staff_id,day_of_week,start_time,end_time"}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({availability:data},{status:201});
    }
    if (action === "create_blockout") {
      const staffId=String(body.staffId||""); const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",staffId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff||!body.startsAt||!body.endsAt)return NextResponse.json({error:"Staff member and blockout times are required."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff_blockouts").insert({staff_id:staffId,starts_at:body.startsAt,ends_at:body.endsAt,reason:body.reason||null}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({blockout:data},{status:201});
    }
    if (action === "appointment_status") {
      const target=String(body.status||""); if(!["confirmed","checked_in","in_progress","completed","cancelled","no_show"].includes(target))return NextResponse.json({error:"Invalid appointment status."},{status:400});
      const {data:appointment}=await supabaseAdmin.from("service_appointments").select("id,service_profile_id").eq("id",body.appointmentId).eq("service_profile_id",profile.id).maybeSingle();
      if(!appointment)return NextResponse.json({error:"Appointment not found."},{status:404});
      const {data,error}=await supabaseAdmin.rpc("transition_service_appointment_status",{p_appointment_id:appointment.id,p_to_status:target,p_actor_type:"provider",p_actor_user_id:user.id,p_note:body.reason||null});
      if(error){const status=error.message.startsWith("invalid_status_transition")?409:error.message.includes("appointment_not_found")?404:400;return NextResponse.json({error:error.message},{status});}
      return NextResponse.json({appointment:data});
    }
    return NextResponse.json({error:"Unknown action."},{status:400});
  } catch(error) { console.error("provider service management",error); return NextResponse.json({error:"Unable to complete provider action."},{status:500}); }
}
