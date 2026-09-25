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
  let q = supabaseAdmin.from("businesses").select("id,name,slug,status,verified,claimed,owner_id").eq("owner_id", userId).in("status", ["active", "ACTIVE", "inactive", "INACTIVE"]);
  if (businessId) q = q.eq("id", businessId);
  return (await q.order("created_at", { ascending: true }).limit(1).maybeSingle()).data;
}
async function ownedProfile(userId: string, profileId?: string) {
  const business = await ownedBusiness(userId); if (!business) return null;
  let q = supabaseAdmin.from("service_profiles").select("id,business_id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days,service_fee_percent,service_fee_minimum,customer_fee_percent,customer_fee_minimum,customer_fee_maximum,payout_minimum,payout_schedule").eq("business_id", business.id);
  if (profileId) q = q.eq("id", profileId);
  const { data } = await q.maybeSingle();
  return data ? { ...data, business } : null;
}
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function safePhotoUrl(value: unknown) { const url=String(value||"").trim(); return /^https:\/\//i.test(url) && url.length<=2048 ? url : null; }

async function ensureSupplierAccount(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }, businessId: string) {
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,onboarding_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    if (existing.business_id !== businessId) {
      throw new Error("This account is already linked to a different supplier business.");
    }
    return existing;
  }

  const contactName = String(user.user_metadata?.full_name || user.email || "Supplier").trim().slice(0, 120);
  const { data, error } = await supabaseAdmin
    .from("supplier_accounts")
    .insert({
      user_id: user.id,
      business_id: businessId,
      contact_name: contactName || "Supplier",
      invitation_status: "pending",
      onboarding_status: "draft",
      completion_percent: 0,
    })
    .select("id,business_id,onboarding_status")
    .single();
  if (error) throw error;
  return data;
}


export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
    const body = await request.json(); const action = String(body.action || "");

    if (action === "create_business") {
      if (!body.name || !body.businessType || !body.phone) return NextResponse.json({ error: "Business name, type and phone are required." }, { status: 400 });
      const existing = await ownedBusiness(user.id);
      if (existing) {
        try { await ensureSupplierAccount(user, existing.id); }
        catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to link supplier onboarding." }, { status: 409 }); }
        return NextResponse.json({ business: existing });
      }
      const base = slugify(body.name) || `partner-${Date.now()}`;
      const { data, error } = await supabaseAdmin.from("businesses").insert({ owner_id:user.id, name:String(body.name).trim(), slug:`${base}-${Date.now().toString(36)}`, business_type:String(body.businessType).trim(), phone:String(body.phone).trim(), whatsapp:body.whatsapp || body.phone, email:user.email, status:"INACTIVE", verified:false, claimed:true }).select("id,name,slug,status,verified,claimed").single();
      if (error) return NextResponse.json({ error:error.message }, { status:400 });
      try {
        await ensureSupplierAccount(user, data.id);
      } catch (supplierError) {
        await supabaseAdmin.from("businesses").delete().eq("id", data.id).eq("owner_id", user.id);
        return NextResponse.json({ error: supplierError instanceof Error ? supplierError.message : "Unable to create supplier onboarding." }, { status: 409 });
      }
      return NextResponse.json({ business:data }, { status:201 });
    }

    if (action === "create_profile") {
      const business = await ownedBusiness(user.id, body.businessId); if (!business) return NextResponse.json({ error:"Business not found." }, { status:404 });
      const existing = await supabaseAdmin.from("service_profiles").select("id").eq("business_id", business.id).maybeSingle(); if (existing.data) return NextResponse.json({ error:"A service profile already exists for this business." }, { status:409 });
      const { data: category } = await supabaseAdmin.from("service_categories").select("id").eq("slug", String(body.categorySlug || "")).eq("status","active").maybeSingle(); if (!category) return NextResponse.json({ error:"Choose a valid service category." }, { status:400 });
      await ensureSupplierAccount(user, business.id); const { data, error } = await supabaseAdmin.from("service_profiles").insert({ business_id:business.id, category_id:category.id, status:"pending", booking_status:"closed", timezone:body.timezone || "Africa/Nairobi", cancellation_policy:body.cancellationPolicy || null, booking_notice_minutes:Math.max(0, Number(body.bookingNoticeMinutes ?? 60)), max_booking_days:Math.max(1, Number(body.maxBookingDays ?? 90)), service_fee_percent:10, service_fee_minimum:30, customer_fee_percent:0, customer_fee_minimum:0, customer_fee_maximum:0, payout_minimum:1000, payout_schedule:"weekly" }).select("id,business_id,category_id,status,booking_status,timezone,cancellation_policy,booking_notice_minutes,max_booking_days,service_fee_percent,service_fee_minimum,customer_fee_percent,customer_fee_minimum,customer_fee_maximum,payout_minimum,payout_schedule").single();
      if (error) return NextResponse.json({ error:error.message }, { status:400 }); return NextResponse.json({ profile:data }, { status:201 });
    }

    const profile = await ownedProfile(user.id, body.serviceProfileId); if (!profile) return NextResponse.json({ error:"Service profile not found." }, { status:404 });

    if (action === "update_profile") {
      const patch:any = {};
      if (body.timezone) patch.timezone=String(body.timezone);
      if (body.cancellationPolicy!==undefined) patch.cancellation_policy=body.cancellationPolicy||null;
      if (body.bookingNoticeMinutes!==undefined) patch.booking_notice_minutes=Math.max(0,Number(body.bookingNoticeMinutes));
      if (body.maxBookingDays!==undefined) patch.max_booking_days=Math.max(1,Number(body.maxBookingDays));
      if (body.serviceFeePercent!==undefined) patch.service_fee_percent=Math.min(100,Math.max(0,Number(body.serviceFeePercent)));
      if (body.serviceFeeMinimum!==undefined) patch.service_fee_minimum=Math.max(0,Number(body.serviceFeeMinimum));
      if (body.payoutMinimum!==undefined) patch.payout_minimum=Math.max(0,Number(body.payoutMinimum));
      if (body.payoutSchedule!==undefined && ["weekly","manual"].includes(String(body.payoutSchedule))) patch.payout_schedule=String(body.payoutSchedule);
      const { data,error } = await supabaseAdmin.from("service_profiles").update(patch).eq("id",profile.id).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({profile:data});
    }
    if (action === "toggle_booking") {
      const open=Boolean(body.open);
      if(open){
        const { data: supplierAccount, error: supplierError } = await supabaseAdmin
          .from("supplier_accounts")
          .select("onboarding_status")
          .eq("user_id", user.id)
          .eq("business_id", profile.business.id)
          .maybeSingle();
        if (supplierError) return NextResponse.json({ error: supplierError.message }, { status: 500 });
        if (!supplierAccount || !["approved", "live"].includes(String(supplierAccount.onboarding_status))) {
          return NextResponse.json({ error:"SafariPlug staff approval is required before opening customer bookings." },{status:409});
        }
        if (!["active", "ACTIVE"].includes(String(profile.business.status || ""))) {
          return NextResponse.json({ error:"This supplier business is not active yet." },{status:409});
        }
        const {data:staffRows}=await supabaseAdmin
          .from("service_staff")
          .select("id,identity_liveness_verified_at")
          .eq("service_profile_id",profile.id)
          .eq("status","active")
          .eq("verification_state","verified")
          .not("user_id","is",null)
          .not("personal_photo_url","is",null);
        const candidateStaff=staffRows??[];
        const candidateIds=candidateStaff.map((row)=>String(row.id));
        const {data:approvedCases}=candidateIds.length
          ? await supabaseAdmin
              .from("verification_cases")
              .select("subject_id,provider,expires_at")
              .eq("subject_type","service_staff")
              .in("subject_id",candidateIds)
              .eq("status","approved")
          : {data:[] as {subject_id:string;provider:string|null;expires_at:string|null}[]};
        const approvedProvider=new Map(
          (approvedCases??[])
            .filter((row)=>!row.expires_at||new Date(row.expires_at).getTime()>Date.now())
            .map((row)=>[String(row.subject_id),String(row.provider||"")])
        );
        const verifiedStaff=candidateStaff.filter((row)=>
          approvedProvider.get(String(row.id))==="human_review"||Boolean(row.identity_liveness_verified_at)
        );
        if(!verifiedStaff.length)return NextResponse.json({error:"Add at least one active specialist with a personal photo, linked SafariPlug account, and approved SafariPlug staff review or identity + live face verification before opening bookings."},{status:409});
      }
      const {data,error}=await supabaseAdmin.from("service_profiles").update({booking_status:open?"open":"closed",status:"active"}).eq("id",profile.id).select("id,status,booking_status").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({profile:data});
    }
    if (action === "create_offering") {
      if (!body.name || !body.durationMinutes) return NextResponse.json({error:"Service name and duration are required."},{status:400});
      const baseSlug=slugify(String(body.name)); const slug=`${baseSlug}-${Date.now().toString(36)}`;
      const {data,error}=await supabaseAdmin.from("service_offerings").insert({service_profile_id:profile.id,category_id:profile.category_id,name:String(body.name).trim(),slug,description:body.description||null,duration_minutes:Number(body.durationMinutes),price:Number(body.price??0),currency:body.currency||"KES",status:body.active===false?"draft":"active",requires_confirmation:Boolean(body.requiresConfirmation)}).select("id,name,description,duration_minutes,price,currency,status,requires_confirmation").single();
      if(error)return NextResponse.json({error:error.message},{status:400});
      const {data:staffRows,error:staffError}=await supabaseAdmin.from("service_staff").select("id").eq("service_profile_id",profile.id).eq("status","active");
      if(staffError)return NextResponse.json({error:staffError.message},{status:500});
      if(staffRows?.length){
        const {error:assignmentError}=await supabaseAdmin.from("service_staff_offerings").upsert(staffRows.map((member)=>({staff_id:member.id,offering_id:data.id})),{onConflict:"staff_id,offering_id"});
        if(assignmentError)return NextResponse.json({error:assignmentError.message},{status:500});
      }
      return NextResponse.json({offering:data},{status:201});
    }
    if (action === "update_offering") {
      if(!body.offeringId)return NextResponse.json({error:"Offering is required."},{status:400}); const {data:offering}=await supabaseAdmin.from("service_offerings").select("id").eq("id",body.offeringId).eq("service_profile_id",profile.id).maybeSingle(); if(!offering)return NextResponse.json({error:"Offering not found."},{status:404}); const patch:any={}; for(const [key,value] of [["name",body.name],["description",body.description],["duration_minutes",body.durationMinutes],["price",body.price],["currency",body.currency],["status",body.status],["requires_confirmation",body.requiresConfirmation]] as const)if(value!==undefined)patch[key]=value; const {data,error}=await supabaseAdmin.from("service_offerings").update(patch).eq("id",body.offeringId).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({offering:data});
    }
    if (action === "create_staff") {
      if(!body.displayName)return NextResponse.json({error:"Team member name is required."},{status:400});
      const rawPhoto=String(body.personalPhotoUrl||"").trim();
      const photo=rawPhoto?safePhotoUrl(rawPhoto):null;
      if(rawPhoto&&!photo)return NextResponse.json({error:"Personal photo must use a secure HTTPS URL."},{status:400});
      const {data,error}=await supabaseAdmin.from("service_staff").insert({service_profile_id:profile.id,display_name:String(body.displayName).trim(),bio:body.bio||null,personal_photo_url:photo,status:"active"}).select("id,display_name,bio,personal_photo_url,user_id,status,verification_state,identity_liveness_verified_at").single();
      if(error)return NextResponse.json({error:error.message},{status:400});
      const {data:offeringRows,error:offeringError}=await supabaseAdmin.from("service_offerings").select("id").eq("service_profile_id",profile.id);
      if(offeringError)return NextResponse.json({error:offeringError.message},{status:500});
      if(offeringRows?.length){
        const {error:assignmentError}=await supabaseAdmin.from("service_staff_offerings").upsert(offeringRows.map((offering)=>({staff_id:data.id,offering_id:offering.id})),{onConflict:"staff_id,offering_id"});
        if(assignmentError)return NextResponse.json({error:assignmentError.message},{status:500});
      }
      return NextResponse.json({staff:data},{status:201});
    }
    if (action === "update_staff_photo") {
      const photo=safePhotoUrl(body.personalPhotoUrl); if(!body.staffId||!photo)return NextResponse.json({error:"Team member and a secure HTTPS personal photo URL are required."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff").update({personal_photo_url:photo}).eq("id",body.staffId).eq("service_profile_id",profile.id).select("id,display_name,bio,personal_photo_url,user_id,status,verification_state,identity_liveness_verified_at").maybeSingle(); if(error)return NextResponse.json({error:error.message},{status:400}); if(!data)return NextResponse.json({error:"Team member not found."},{status:404}); return NextResponse.json({staff:data});
    }
    if (action === "assign_staff") {
      const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",body.staffId).eq("service_profile_id",profile.id).maybeSingle(); const {data:offering}=await supabaseAdmin.from("service_offerings").select("id").eq("id",body.offeringId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff||!offering)return NextResponse.json({error:"Staff member or service not found."},{status:404}); const {error}=await supabaseAdmin.from("service_staff_offerings").upsert({staff_id:staff.id,offering_id:offering.id}); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({ok:true});
    }
    if (action === "set_availability") {
      const staffId=String(body.staffId||""); const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",staffId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff)return NextResponse.json({error:"Staff member not found."},{status:404}); const day=Number(body.dayOfWeek),start=String(body.startTime||""),end=String(body.endTime||""); if(!Number.isInteger(day)||day<0||day>6||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)||start>=end)return NextResponse.json({error:"Choose a valid day and time range."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff_availability").upsert({staff_id:staffId,day_of_week:day,start_time:start,end_time:end,is_active:true},{onConflict:"staff_id,day_of_week,start_time,end_time"}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({availability:data},{status:201});
    }
    if (action === "create_blockout") {
      const staffId=String(body.staffId||""); const {data:staff}=await supabaseAdmin.from("service_staff").select("id").eq("id",staffId).eq("service_profile_id",profile.id).maybeSingle(); if(!staff||!body.startsAt||!body.endsAt)return NextResponse.json({error:"Staff member and blockout times are required."},{status:400}); const startsAt=new Date(body.startsAt),endsAt=new Date(body.endsAt); if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime())||startsAt>=endsAt)return NextResponse.json({error:"Choose a valid blockout time range."},{status:400}); const {data,error}=await supabaseAdmin.from("service_staff_blockouts").insert({staff_id:staffId,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),reason:body.reason||null}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({blockout:data},{status:201});
    }
    if (action === "appointment_status") {
      const target=String(body.status||""); if(!["confirmed","checked_in","in_progress","completed","cancelled","no_show"].includes(target))return NextResponse.json({error:"Invalid appointment status."},{status:400});
      const {data:appointment}=await supabaseAdmin.from("service_appointments").select("id,service_profile_id,payment_status").eq("id",body.appointmentId).eq("service_profile_id",profile.id).maybeSingle();
      if(!appointment)return NextResponse.json({error:"Appointment not found."},{status:404});
      if(target === "cancelled" && ["paid", "partially_refunded"].includes(appointment.payment_status)) return NextResponse.json({error:"This appointment has a settled payment and requires a refund review before cancellation."},{status:409});
      const {data,error}=await supabaseAdmin.rpc("transition_service_appointment_status",{p_appointment_id:appointment.id,p_to_status:target,p_actor_type:"provider",p_actor_user_id:user.id,p_note:body.reason||null});
      if(error){const status=error.message.startsWith("invalid_status_transition")?409:error.message.includes("settled_payment_requires_refund_review")?409:error.message.includes("appointment_not_found")?404:400;return NextResponse.json({error:error.message.includes("settled_payment_requires_refund_review")?"This appointment has a settled payment and requires a refund review before cancellation.":error.message},{status});}
      return NextResponse.json({appointment:data});
    }
    return NextResponse.json({error:"Unknown action."},{status:400});
  } catch(error) { console.error("provider service management",error); return NextResponse.json({error:"Unable to complete provider action."},{status:500}); }
}
