import { NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Product="hotel"|"activity"|"transfer"|"service";

function config(product:Product){
  if(product==="hotel")return{table:"hotel_booking_pricing_ledger",amount:"customer_retail_amount",fallback:"retail_amount",currency:"customer_currency",fallbackCurrency:"currency",booking:"booking_status"};
  if(product==="activity")return{table:"activity_booking_pricing_ledger",amount:"retail_amount",fallback:"retail_amount",currency:"customer_currency",fallbackCurrency:"customer_currency",booking:"booking_status"};
  if(product==="transfer")return{table:"transfer_booking_pricing_ledger",amount:"retail_amount",fallback:"retail_amount",currency:"customer_currency",fallbackCurrency:"customer_currency",booking:"booking_status"};
  return{table:"service_appointments",amount:"customer_total_amount",fallback:"price",currency:"currency",fallbackCurrency:"currency",booking:"status"};
}

export async function POST(request:Request){
  try{
    const admin=await requireAdmin();
    const body=await request.json().catch(()=>null);
    const product=String(body?.product||"") as Product;
    const sourceId=String(body?.sourceId||"").trim();
    const notes=typeof body?.notes==="string"?body.notes.trim().slice(0,2000):"";
    if(!["hotel","activity","transfer","service"].includes(product)||!sourceId)return NextResponse.json({error:"Product and source are required."},{status:400});
    const cfg=config(product);
    const {data:rawRow,error}=await supabaseAdmin.from(cfg.table).select("*").eq("id",sourceId).maybeSingle();
    const row:any=rawRow;
    if(error)return NextResponse.json({error:error.message},{status:500});
    if(!row)return NextResponse.json({error:"Payment record not found."},{status:404});
    if(row.payment_status!=="paid"||!row.payment_reference||!row.paid_at)return NextResponse.json({error:"Proof requires a paid record with provider payment reference and paid_at evidence."},{status:409});
    const bookingStatus=String((row as any)[cfg.booking]||"");
    if(product!=="service"&&bookingStatus!=="confirmed")return NextResponse.json({error:"Travel payment proof requires a confirmed supplier booking."},{status:409});
    if(product==="service"&&!["confirmed","checked_in","in_progress","completed"].includes(bookingStatus))return NextResponse.json({error:"Service proof requires a paid active/completed appointment."},{status:409});
    const amount=Number((row as any)[cfg.amount]??(row as any)[cfg.fallback]??0);
    const currency=String((row as any)[cfg.currency]??(row as any)[cfg.fallbackCurrency]??"KES");
    const paymentProvider=product==="service"?"mpesa":String((row as any).payment_provider||"unknown");
    if(paymentProvider!=="mpesa"&&currency==="KES")return NextResponse.json({error:"This production proof workspace is currently for M-Pesa evidence."},{status:409});

    const {data:proof,error:proofError}=await supabaseAdmin.from("production_payment_proofs").upsert({
      product,source_id:sourceId,payment_provider:paymentProvider,payment_reference:String(row.payment_reference),currency,amount,booking_status:bookingStatus,verified_by:admin.id,verified_at:new Date().toISOString(),notes:notes||null,
      evidence_summary:{paidAt:row.paid_at,confirmedAt:(row as any).confirmed_at||null,recordState:{paymentStatus:row.payment_status,bookingStatus}},
    },{onConflict:"product,source_id"}).select("*").single();
    if(proofError)return NextResponse.json({error:proofError.message},{status:500});
    return NextResponse.json({proof});
  }catch(error){
    if(error instanceof AdminAuthError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Unable to record production payment proof."},{status:500});
  }
}
