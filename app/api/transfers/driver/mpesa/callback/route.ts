import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CallbackItem = { Name?: string; Value?: unknown };

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = String(callback?.CheckoutRequestID || "").trim();
    const resultCode = Number(callback?.ResultCode);

    if (!checkoutRequestId) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: attempt } = await supabaseAdmin
      .from("driver_transfer_payment_attempts")
      .select("id,request_id,status,amount,currency")
      .eq("provider", "mpesa")
      .eq("provider_reference", checkoutRequestId)
      .maybeSingle();

    if (!attempt) {
      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type: "driver_transfer_mpesa_callback_unmatched",
        metadata: {
          checkoutRequestId,
          resultCode: Number.isFinite(resultCode) ? resultCode : null,
          receivedAt: new Date().toISOString(),
        },
      }).then(({ error }) => { if (error) console.error("Driver transfer callback telemetry failed", error); });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: transfer } = await supabaseAdmin
      .from("driver_transfer_requests")
      .select("id,quoted_amount,currency,payment_status,payment_reference,status")
      .eq("id", attempt.request_id)
      .maybeSingle();

    if (!transfer) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (transfer.payment_status === "paid" && attempt.status === "succeeded") {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const items: CallbackItem[] = Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const metadataMap: Record<string, unknown> = Object.fromEntries(
      items.map((item) => [String(item.Name || ""), item.Value ?? null]).filter(([key]) => Boolean(key)),
    );

    const callbackAmount = Number(metadataMap.Amount);
    const expectedAmount = Number(transfer.quoted_amount);
    const receipt = String(metadataMap.MpesaReceiptNumber || "").trim();
    const amountMatches =
      Number.isFinite(callbackAmount) &&
      Number.isFinite(expectedAmount) &&
      Math.round(callbackAmount) === Math.round(expectedAmount);
    const currencyMatches = String(transfer.currency || "").toUpperCase() === String(attempt.currency || "").toUpperCase();
    const success = resultCode === 0;
    const verifiedSuccess = success && amountMatches && currencyMatches && Boolean(receipt);
    const now = new Date().toISOString();

    if (verifiedSuccess) {
      await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ status: "succeeded", updated_at: now })
        .eq("id", attempt.id);

      await supabaseAdmin
        .from("driver_transfer_requests")
        .update({
          payment_status: "paid",
          payment_reference: checkoutRequestId,
          paid_at: now,
          updated_at: now,
        })
        .eq("id", transfer.id)
        .neq("payment_status", "paid");
    } else if (success) {
      await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ status: "uncertain", updated_at: now })
        .eq("id", attempt.id);

      await supabaseAdmin
        .from("driver_transfer_requests")
        .update({ payment_status: "pending", updated_at: now })
        .eq("id", transfer.id)
        .neq("payment_status", "paid");

      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type: "driver_transfer_mpesa_callback_verification_failed",
        metadata: {
          transferRequestId: transfer.id,
          checkoutRequestId,
          receipt: receipt || null,
          callbackAmount: Number.isFinite(callbackAmount) ? callbackAmount : null,
          expectedAmount: Number.isFinite(expectedAmount) ? expectedAmount : null,
          amountMatches,
          currencyMatches,
          receivedAt: now,
        },
      }).then(({ error }) => { if (error) console.error("Driver transfer callback verification telemetry failed", error); });
    } else {
      await supabaseAdmin
        .from("driver_transfer_payment_attempts")
        .update({ status: "failed", updated_at: now })
        .eq("id", attempt.id);

      await supabaseAdmin
        .from("driver_transfer_requests")
        .update({ payment_status: "failed", updated_at: now })
        .eq("id", transfer.id)
        .neq("payment_status", "paid");
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("Driver transfer M-Pesa callback error", error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
