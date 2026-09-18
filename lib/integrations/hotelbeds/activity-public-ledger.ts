type LedgerLike = Record<string, unknown>;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function publicActivityCheckoutLedger(row: LedgerLike | null | undefined) {
  if (!row) return null;
  const metadata = record(row.metadata);
  return {
    id: row.id ?? null,
    prepared_booking_id: row.prepared_booking_id ?? null,
    provider_booking_reference: row.provider_booking_reference ?? null,
    customer_currency: row.customer_currency ?? null,
    retail_amount: row.retail_amount ?? null,
    payment_status: row.payment_status ?? null,
    booking_status: row.booking_status ?? null,
    supplier_settlement_status: row.supplier_settlement_status ?? null,
    paid_at: row.paid_at ?? null,
    preconfirmed_at: row.preconfirmed_at ?? null,
    confirmed_at: row.confirmed_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    activity: record(metadata.activity),
    cancellationPolicies: Array.isArray(metadata.cancellationPolicies)
      ? metadata.cancellationPolicies
      : [],
  };
}
