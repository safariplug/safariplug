import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAndApplyPaymentWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body=await request.json(); const callback=body?.Body?.stkCallback; const checkoutRequestId=String(callback?.CheckoutRequestID||"");
    if(!checkoutRequestId)return NextResponse.json({ResultCode:1,ResultDesc:"Missing CheckoutRequestID"},{status:400});
    const resultCode=Number(callback?.ResultCode); const metadata=Array.isArray(callback?.CallbackMetadata?.Item)?callback.CallbackMetadata.Item:[]; const receipt=metadata.find((i:{Name?:string})=>i.Name==="MpesaReceiptNumber")?.Value;
    const {data:foodIdem}=await supabaseAdmin.from("food_order_payment_idempotency").select("order_id").eq("provider","mpesa").eq("provider_reference",checkoutRequestId).maybeSingle();
    if(foodIdem?.order_id){await supabaseAdmin.from("food_orders").update({payment_status:resultCode===0?"paid":"failed",payment_reference:receipt?String(receipt):checkoutRequestId}).eq("id",foodIdem.order_id);return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});}
    const {data:idem}=await supabaseAdmin.from("service_payment_idempotency").select("appointment_id").eq("provider","mpesa").eq("provider_reference",checkoutRequestId).maybeSingle(); let appointmentId=idem?.appointment_id??null;
    if(!appointmentId){const {data:appointment}=await supabaseAdmin.from("service_appointments").select("id").eq("payment_status","pending").eq("payment_reference",checkoutRequestId).maybeSingle();appointmentId=appointment?.id??null;}
    if(!appointmentId)return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});
    await recordAndApplyPaymentWebhook({eventId:`mpesa:${checkoutRequestId}:${resultCode}`,provider:"mpesa",eventType:resultCode===0?"stkpush.success":"stkpush.failed",providerReference:receipt?String(receipt):checkoutRequestId,appointmentId,status:resultCode===0?"succeeded":"failed",paidAt:resultCode===0?new Date().toISOString():null,refundedAmount:0,rawPayload:{checkoutRequestId,resultCode,callback}});
    return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});
  } catch(error){console.error("M-Pesa callback error",error);return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});}
}
