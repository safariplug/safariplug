import {
  assertHotelbedsBookingRateReady,
  hotelbedsRequiresCheckRate,
  type HotelbedsCertificationRate,
} from "./hotelbeds-certification";

type CheckRateClient<T> = {
  checkRate: (rateKey: string) => Promise<T>;
};

export type PreparedHotelbedsRate<T> = {
  original: HotelbedsCertificationRate;
  checkRateRequired: boolean;
  checkRateCompleted: boolean;
  checked: T | null;
};

export async function prepareHotelbedsRateForBooking<T>(
  client: CheckRateClient<T>,
  rate: HotelbedsCertificationRate
): Promise<PreparedHotelbedsRate<T>> {
  if (!rate.rateKey?.trim()) throw new Error("Hotelbeds rateKey is required before booking.");

  const checkRateRequired = hotelbedsRequiresCheckRate(rate.rateType);
  if (!checkRateRequired) {
    assertHotelbedsBookingRateReady(rate, false);
    return {
      original: rate,
      checkRateRequired: false,
      checkRateCompleted: false,
      checked: null,
    };
  }

  // Certification requires Availability -> CheckRate (only for RECHECK) -> Booking.
  // Do not call Availability again here.
  const checked = await client.checkRate(rate.rateKey);
  assertHotelbedsBookingRateReady(rate, true);
  return {
    original: rate,
    checkRateRequired: true,
    checkRateCompleted: true,
    checked,
  };
}
