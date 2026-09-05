import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const b = await request.json();
    for (const k of ["serviceProfileId","offeringId","staffId","customerName","startsAt"]) if (!b[k]) return NextResponse.json({ error: `${k} is required` }, { status: 400 });
    if (!b.customerEmail && !b.customerPhone) return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    const { data: appointment, error } = await supabaseAdmin.rpc("create_service_appointment", { p_service_profile_id:b.serviceProfileId,p_offering_id:b.offeringId,p_staff_id:b.staffId,p_customer_user_id:null,p_customer_name:b.customerName,p_customer_email:b.customerEmail??null,p_customer_phone:b.customerPhone??null,p_starts_at:b.startsAt,p_customer_notes:b.customerNotes??null });
    if (error) return NextResponse.json({ error:error.message }, { status: error.message.includes("slot_unavailable") ? 409 : 400 });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch { return NextResponse.json({ error:"Invalid request" }, { status:400 }); }
}