import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function fail(status:number,code:string,message:string){
  return NextResponse.json({success:false,error:{code,message}},{status});
}

export async function GET(request:Request){
  const authorization=request.headers.get("authorization")||"";
  const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
  if(!token)return fail(401,"unauthorized","Staff sign-in is required.");

  const {data:{user},error:userError}=await supabaseAdmin.auth.getUser(token);
  if(userError||!user)return fail(401,"unauthorized","The mobile session is not valid.");

  const {data:admin,error:adminError}=await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id",user.id)
    .maybeSingle();
  if(adminError)return fail(500,"staff_lookup_failed","Unable to verify SafariPlug staff access.");
  if(!admin)return fail(403,"forbidden","This SafariPlug account does not have staff access.");

  const [supplierReviews,refundReviews,payoutActions,eventReviews,verificationReviews]=await Promise.all([
    supabaseAdmin.from("supplier_accounts").select("id",{count:"exact",head:true}).eq("onboarding_status","submitted"),
    supabaseAdmin.from("travel_refund_reviews").select("id",{count:"exact",head:true}).eq("product","service").in("status",["pending","in_review"]),
    supabaseAdmin.from("service_provider_payouts").select("id",{count:"exact",head:true}).in("status",["eligible","approved","processing","held","failed"]),
    supabaseAdmin.from("ai_discovered_events").select("id",{count:"exact",head:true}).in("status",["pending","pending_review"]),
    supabaseAdmin.from("verification_cases").select("id",{count:"exact",head:true}).in("status",["not_started","pending","in_review"]),
  ]);

  const errors=[supplierReviews.error,refundReviews.error,payoutActions.error,eventReviews.error,verificationReviews.error].filter(Boolean);
  if(errors.length)return fail(500,"staff_overview_failed","Unable to load the staff operations overview.");

  const data={
    role:admin.role,
    email:user.email||null,
    queues:{
      supplierReviews:supplierReviews.count||0,
      refundReviews:refundReviews.count||0,
      payoutActions:payoutActions.count||0,
      eventReviews:eventReviews.count||0,
      verificationReviews:verificationReviews.count||0,
    },
  };
  return NextResponse.json({success:true,data});
}
