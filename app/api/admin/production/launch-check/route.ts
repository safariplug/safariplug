import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

const KEYS=new Set([
  "public_smoke",
  "signed_in_traveler_journey",
  "booking_visible_in_account",
  "trip_attachment",
  "transfer_flow",
  "mobile_traveler_journey",
]);
const STATUSES=new Set(["pending","passed","failed"]);

export async function POST(request:Request){
  try{
    const admin=await requireAdmin();
    const body=await request.json().catch(()=>null);
    const checkKey=String(body?.checkKey||"");
    const status=String(body?.status||"");
    const note=typeof body?.note==="string"?body.note.trim().slice(0,2000):"";
    if(!KEYS.has(checkKey)||!STATUSES.has(status))return NextResponse.json({error:"Invalid launch check."},{status:400});

    const now=new Date().toISOString();
    const {data,error}=await supabaseAdmin.from("production_launch_checks").upsert({
      check_key:checkKey,
      status,
      note:note||null,
      verified_by:status==="pending"?null:admin.id,
      verified_at:status==="pending"?null:now,
      updated_at:now,
    },{onConflict:"check_key"}).select("*").single();

    if(error)return NextResponse.json({error:error.message},{status:500});
    return NextResponse.json({check:data});
  }catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to update launch check."},{status:500});
  }
}
