import { emitGrowthEvent, emitGrowthEvents, stableGrowthEventId, type GrowthEventInput } from "./events";

export async function emitHotelBookingStart(input: {
  provider: "locktrip" | "hotelbeds";
  intentId: string;
  productId: string;
  hotelName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  return emitGrowthEvent({
    event_id: stableGrowthEventId("booking-start", input.intentId),
    event_type: "BOOKING_START",
    source: "safariplug-server",
    product_id: input.productId,
    product_type: "hotel",
    category: "hotels",
    landing_url: "https://www.safariplug.com/hotels/book",
    metadata: {
      booking_context: true,
      booking_step: "payment_start",
      provider: input.provider,
      hotel_name: input.hotelName || undefined,
      check_in: input.checkIn || undefined,
      check_out: input.checkOut || undefined,
    },
  });
}

export async function emitConfirmedHotelBooking(input: {
  provider: "locktrip" | "hotelbeds";
  ledgerId: string;
  productId: string;
  confirmationRef?: string | null;
  value?: number | null;
  currency?: string | null;
  hotelName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  const bookingEventId = stableGrowthEventId("booking-complete", input.ledgerId);
  const events: GrowthEventInput[] = [
    {
      event_id: bookingEventId,
      event_type: "BOOKING_COMPLETE" as const,
      source: "safariplug-server" as const,
      product_id: input.productId,
      product_type: "hotel",
      category: "hotels",
      landing_url: "https://www.safariplug.com/hotels/booking-result",
      metadata: {
        confirmation: true,
        confirmation_ref: input.confirmationRef || undefined,
        booking_id: input.ledgerId,
        booking_complete: true,
        provider: input.provider,
        hotel_name: input.hotelName || undefined,
        check_in: input.checkIn || undefined,
        check_out: input.checkOut || undefined,
        currency: input.currency || undefined,
      },
    },
  ];

  const value = Number(input.value);
  if (Number.isFinite(value) && value > 0) {
    events.push({
      event_id: stableGrowthEventId("revenue", input.ledgerId),
      event_type: "REVENUE",
      source: "safariplug-server",
      product_id: input.productId,
      product_type: "hotel",
      category: "hotels",
      landing_url: "https://www.safariplug.com/hotels/booking-result",
      value,
      metadata: {
        booking_event_id: bookingEventId,
        booking_id: input.ledgerId,
        confirmation_ref: input.confirmationRef || undefined,
        provider: input.provider,
        currency: input.currency || undefined,
      },
    });
  }

  return emitGrowthEvents(events);
}
