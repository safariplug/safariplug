import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findServiceProviderPayoutByMpesaReferences } from "@/lib/payments/mpesa-payout-correlation";

export const dynamic = "force-dynamic";

function callbackError(status:number,description:string){
  return NextResponse.json({ResultCode:1,ResultDesc:description},{status});
}

export async function POST(request: Request) {
  const secret = process.env.MPESA_B2C_CALLBACK_SECRET?.trim();
  if (!secret || new URL(request.url).searchParams.get("token") !== secret) {
    return callbackError(401,"Unauthorized");
  }

  try {
    const body=await request.json();
    const result=body?.Result && typeof body.Result==="object" ? body.Result : body;
    const conversationId=String(result?.ConversationID||"").trim();
    const originatorConversationId=String(result?.OriginatorConversationID||"").trim();

    if(!conversationId&&!originatorConversationId){
      console.error("M-Pesa B2C queue timeout missing correlation identifiers",body);
      return callbackError(400,"Missing ConversationID");
    }

    const payout=await findServiceProviderPayoutByMpesaReferences([
      conversationId,
      originatorConversationId,
    ]);

    if(!payout){
      console.error("Unmatched M-Pesa B2C queue timeout",{
        conversationId,
        originatorConversationId,
      });
      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type:"service_provider_payout_callback_unmatched",
        metadata:{kind:"timeout",conversationId:conversationId||null,originatorConversationId:originatorConversationId||null,receivedAt:new Date().toISOString()}
      }).then(({error})=>{if(error)console.error("Failed to persist unmatched payout timeout telemetry",error);});
      return callbackError(409,"Payout timeout could not be matched");
    }

    if(["paid","failed","cancelled"].includes(payout.status)){
      return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});
    }

    const now=new Date().toISOString();
    const existingMetadata=
      payout.metadata&&typeof payout.metadata==="object"&&!Array.isArray(payout.metadata)
        ? payout.metadata as Record<string,unknown>
        : {};

    const update:Record<string,unknown>={
      payout_provider:"mpesa_b2c",
      failure_reason:"mpesa_b2c_queue_timeout_reconciliation_required",
      metadata:{
        ...existingMetadata,
        b2c_timeout:body,
        timeoutRecordedAt:now,
      },
      updated_at:now,
    };

    if(conversationId){
      update.mpesa_conversation_id=conversationId;
      update.conversation_id=conversationId;
    }
    if(originatorConversationId){
      update.originator_conversation_id=originatorConversationId;
      if(!conversationId) update.mpesa_conversation_id=originatorConversationId;
    }

    const {data:updated,error:updateError}=await supabaseAdmin
      .from("service_provider_payouts")
      .update(update)
      .eq("id",payout.id)
      .in("status",["processing","approved"])
      .select("id,status")
      .maybeSingle();

    if(updateError) throw updateError;
    if(updated){
      await supabaseAdmin.from("admin_telemetry_logs").insert({
        action_type:"service_provider_payout_timeout_reconciliation",
        metadata:{payoutId:payout.id,conversationId:conversationId||null,originatorConversationId:originatorConversationId||null,recordedAt:now}
      }).then(({error})=>{if(error)console.error("Failed to persist payout timeout telemetry",error);});
      console.warn("M-Pesa B2C queue timeout requires reconciliation",{
        payoutId:payout.id,
        conversationId:conversationId||null,
        originatorConversationId:originatorConversationId||null,
      });
      return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});
    }

    const {data:current,error:currentError}=await supabaseAdmin
      .from("service_provider_payouts")
      .select("status")
      .eq("id",payout.id)
      .maybeSingle();
    if(currentError) throw currentError;
    if(current&&["paid","failed","cancelled"].includes(current.status)){
      return NextResponse.json({ResultCode:0,ResultDesc:"Accepted"});
    }

    return callbackError(409,"Payout timeout state was not recorded");
  } catch (error) {
    console.error("M-Pesa B2C timeout callback persistence error",error);
    return callbackError(500,"Timeout callback persistence failed");
  }
}
