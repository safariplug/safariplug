import type { HotelSearchResult } from "./types";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildHotelbedsCertificationStay(now = new Date(), daysOut = 30, nights = 2) {
  const checkIn = new Date(now);
  checkIn.setUTCHours(12, 0, 0, 0);
  checkIn.setUTCDate(checkIn.getUTCDate() + Math.max(1, Math.floor(daysOut)));
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + Math.max(1, Math.floor(nights)));
  return { checkIn: isoDate(checkIn), checkOut: isoDate(checkOut) };
}

export function summarizeHotelbedsAvailabilityProbe(results: HotelSearchResult[]) {
  const sample = results[0];
  if (!sample) {
    return {
      resultCount: 0,
      sample: null,
    };
  }

  return {
    resultCount: results.length,
    sample: {
      propertyId: sample.property_id,
      propertyName: sample.property_name,
      roomId: sample.room_id,
      hasRateKey: Boolean(sample.rate_id),
      rateType: sample.supplier_context?.search_key || null,
      rateClass: sample.supplier_context?.rate_class || null,
      boardCode: sample.supplier_context?.board_code || null,
      boardName: sample.supplier_context?.board_name || null,
      cancellation: sample.cancellation,
      total: sample.total,
      notices: sample.supplier_context?.notices || [],
      hasBookingToken: Boolean(sample.supplier_context?.booking_token),
    },
  };
}
