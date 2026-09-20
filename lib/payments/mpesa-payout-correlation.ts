import { supabaseAdmin } from "@/lib/supabase-admin";

export type PayoutCorrelationRow={
  id:string;
  status:string;
  metadata:unknown;
};

export async function findServiceProviderPayoutByMpesaReferences(references:string[]){
  const uniqueReferences=[...new Set(references.map(value=>String(value||"").trim()).filter(Boolean))];
  const exactFields=["mpesa_conversation_id","conversation_id","originator_conversation_id"] as const;

  for(const reference of uniqueReferences){
    for(const field of exactFields){
      const result=await supabaseAdmin
        .from("service_provider_payouts")
        .select("id,status,metadata")
        .eq(field,reference)
        .maybeSingle();
      if(result.error) throw result.error;
      if(result.data) return result.data as PayoutCorrelationRow;
    }

    const byReference=await supabaseAdmin
      .from("service_provider_payouts")
      .select("id,status,metadata")
      .eq("payout_reference",reference)
      .limit(2);
    if(byReference.error) throw byReference.error;
    if((byReference.data||[]).length>1) throw new Error("ambiguous_payout_reference");
    if(byReference.data?.[0]) return byReference.data[0] as PayoutCorrelationRow;
  }

  return null;
}
