import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MpesaPaymentAdapter } from "@/lib/payments/mpesa";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { orderId, phone } = await request.json();
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  const { data: order, error } = await supabaseAdmin.from("food_orders").select("id,customer_user_id,customer_phone,customer_total,currency,payment_status,payment_reference").eq("id", orderId).eq("customer_user_id", user.id).maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid" }, { status: 409 });
  try {
    const adapter = new MpesaPaymentAdapter();
    const intent = await adapter.createPaymentIntent({ appointmentId: order.id, customerPhone: phone || order.customer_phone, amount: Number(order.customer_total), currency: order.currency, metadata: { type: "food_order", orderId: order.id } } as any);
    await supabaseAdmin.from("food_orders").update({ payment_status: "processing", payment_reference: intent.providerReference }).eq("id", order.id).eq("customer_user_id", user.id);
    return NextResponse.json({ status: intent.status, checkoutRequestId: intent.providerReference });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unable to start M-Pesa payment" }, { status: 400 });
  }
}
