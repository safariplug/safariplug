import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await supabaseAdmin.from("service_profiles").select("id,business_id,timezone,businesses!inner(id,name,slug,description,city_id,owner_id),service_categories(name),service_offerings(id,name,slug,description,duration_minutes,price,currency,requires_confirmation)").eq("status","active").eq("booking_status","open").eq("businesses.status","active").eq("service_offerings.status","active");
  if (error) return NextResponse.json({ error: "Unable to load services" }, { status: 500 });
  const owners=[...new Set((data??[]).map((row:any)=>String(row.businesses?.owner_id||"")).filter(Boolean))];
  const readiness=await Promise.all(owners.map(async(ownerId)=>{const {data:ready,error:readyError}=await supabaseAdmin.rpc("service_provider_verification_ready",{p_user_id:ownerId});return [ownerId,!readyError&&ready===true] as const;}));
  const readyOwners=new Set(readiness.filter(([,ready])=>ready).map(([ownerId])=>ownerId));
  return NextResponse.json({ services: (data ?? []).filter((row:any)=>readyOwners.has(String(row.businesses?.owner_id||""))) });
}
