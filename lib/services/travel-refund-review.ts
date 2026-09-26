import { supabaseAdmin } from "@/lib/supabase-admin";

export type TravelRefundProduct = "hotel" | "transfer" | "activity";

export async function queueTravelCancellationRefundReview({
  product,
  ledgerId,
  provider,
  paymentStatus,
  reason,
}: {
  product: TravelRefundProduct;
  ledgerId: string;
  provider: string;
  paymentStatus: string | null | undefined;
  reason: string;
}) {
  if (!["paid", "partially_refunded"].includes(String(paymentStatus || ""))) {
    return null;
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("travel_refund_reviews")
    .select("id,status,resolution")
    .eq("product", product)
    .eq("ledger_id", ledgerId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("travel_refund_reviews")
    .insert({
      product,
      ledger_id: ledgerId,
      provider: provider || "travel-provider",
      reason,
      status: "pending",
      notes: null,
    })
    .select("id,status,resolution")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const { data: concurrent, error: concurrentError } = await supabaseAdmin
        .from("travel_refund_reviews")
        .select("id,status,resolution")
        .eq("product", product)
        .eq("ledger_id", ledgerId)
        .maybeSingle();
      if (concurrentError) throw concurrentError;
      if (concurrent) return concurrent;
    }
    throw error;
  }

  return data;
}
