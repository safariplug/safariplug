import { supabaseAdmin } from "@/lib/supabase-admin";

type Actor = "customer" | "provider";

export async function queuePaidServiceCancellationReview({
  appointmentId,
  actor,
  reason,
}: {
  appointmentId: string;
  actor: Actor;
  reason?: string | null;
}) {
  const { data: ledger, error: ledgerError } = await supabaseAdmin
    .from("service_payment_ledger")
    .select("id,appointment_id,status,payment_reference,provider_reference")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  if (ledgerError) throw ledgerError;
  if (!ledger || !["paid", "partially_refunded"].includes(String(ledger.status))) {
    throw new Error("settled_service_payment_ledger_not_found");
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("travel_refund_reviews")
    .select("id,status,resolution")
    .eq("product", "service")
    .eq("ledger_id", ledger.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: attempt } = await supabaseAdmin
    .from("service_payment_idempotency")
    .select("provider")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const provider = String(attempt?.provider || "service-payment");
  const note = String(reason || "").trim();
  const actorLabel = actor === "customer" ? "Customer" : "Provider";

  const { data, error } = await supabaseAdmin
    .from("travel_refund_reviews")
    .insert({
      product: "service",
      ledger_id: ledger.id,
      provider,
      reason: `${actorLabel} requested cancellation of a paid service appointment.${note ? ` Reason: ${note}` : ""}`,
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
        .eq("product", "service")
        .eq("ledger_id", ledger.id)
        .maybeSingle();
      if (concurrentError) throw concurrentError;
      if (concurrent) return concurrent;
    }
    throw error;
  }

  return data;
}
