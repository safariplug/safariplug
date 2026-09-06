import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalize(value:string) {
  const digits=value.replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

export async function POST(request:Request) {
  const client=await createSupabaseServerClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return NextResponse.json({error:"A confirmed SafariPlug account is required."},{status:401});
  const body=await request.json().catch(()=>null) as {phone?:string}|null;
  const phone=normalize(String(body?.phone||""));
  if(!phone) return NextResponse.json({error:"Enter a valid Kenyan M-Pesa number."},{status:400});
  const {data,error}=await supabaseAdmin.from("service_provider_payout_accounts").upsert({provider_user_id:user.id,provider:"mpesa_b2c",phone,status:"pending",verified_at:null,verified_by:null,rejection_reason:null,updated_at:new Date().toISOString()},{onConflict:"provider_user_id,provider"}).select("provider,phone,status,verified_at,rejection_reason").single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({account:data});
}
