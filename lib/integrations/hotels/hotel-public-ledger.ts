type LedgerLike = Record<string, unknown>;

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function publicHotelCheckoutLedger(row: LedgerLike | null | undefined) {
  if (!row) return null;
  const metadata = record(row.metadata);
  return {
    id: row.id ?? null,
    provider: row.provider ?? null,
    prepared_booking_id: row.prepared_booking_id ?? null,
    provider_booking_reference: row.provider_booking_reference ?? null,
    customer_currency: row.customer_currency ?? row.currency ?? null,
    customer_retail_amount: row.customer_retail_amount ?? row.retail_amount ?? null,
    payment_provider: row.payment_provider ?? null,
    payment_status: row.payment_status ?? null,
    booking_status: row.booking_status ?? null,
    supplier_settlement_status: row.supplier_settlement_status ?? null,
    paid_at: row.paid_at ?? null,
    confirmed_at: row.confirmed_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    hotel: {
      name: metadata.hotelName ?? null,
      id: metadata.hotelId ?? null,
      checkIn: metadata.checkIn ?? null,
      checkOut: metadata.checkOut ?? null,
    },
    cancellation: metadata.cancellation ?? null,
    notices: Array.isArray(metadata.notices) ? metadata.notices : [],
  };
}
