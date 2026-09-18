import assert from "node:assert/strict";
import { test } from "node:test";
import { publicHotelCheckoutLedger } from "./hotel-public-ledger";

test("public hotel ledger excludes booking tokens and supplier/payment internals", () => {
  const output = publicHotelCheckoutLedger({
    id: "ledger-1",
    provider: "hotelbeds",
    prepared_booking_id: "hotelbeds-1",
    provider_booking_reference: "HB-123",
    customer_currency: "KES",
    customer_retail_amount: 25000,
    payment_provider: "mpesa",
    payment_status: "paid",
    booking_status: "confirmed",
    metadata: {
      bookingToken: "SECRET-TOKEN",
      paxes: [{ name: "Jane", surname: "Doe" }],
      holder: { name: "Jane", surname: "Doe" },
      providerBooking: { raw: "supplier-payload" },
      mpesaCallback: { phone: "254700000000", receipt: "ABC" },
      hotelName: "Safari Lodge",
      hotelId: "HOTEL-1",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      cancellation: { amount: 100 },
      notices: ["Passport required"],
    },
  }) as Record<string, unknown>;

  assert.equal("metadata" in output, false);
  assert.equal("bookingToken" in output, false);
  assert.deepEqual(output.hotel, {
    name: "Safari Lodge",
    id: "HOTEL-1",
    checkIn: "2026-10-01",
    checkOut: "2026-10-03",
  });
});
