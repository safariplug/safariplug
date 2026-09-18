import assert from "node:assert/strict";
import { test } from "node:test";
import { publicActivityCheckoutLedger } from "./activity-public-ledger";

test("public Activity ledger excludes internal supplier and traveler metadata", () => {
  const output = publicActivityCheckoutLedger({
    id: "ledger-1",
    prepared_booking_id: "hotelbeds-activity-1",
    provider_booking_reference: "ACT-123",
    customer_currency: "KES",
    retail_amount: 2000,
    payment_status: "paid",
    booking_status: "confirmed",
    supplier_settlement_status: "settled",
    metadata: {
      selectionToken: "secret-selection",
      holder: { name: "Jane", phone: "+254700000000" },
      paxes: [{ name: "Jane", surname: "Doe" }],
      answers: [{ code: "HOTEL", answer: "Safari Lodge" }],
      bookingRequest: { activities: [{ rateKey: "RATE-SECRET" }] },
      preconfirmResponse: { booking: { reference: "ACT-123" } },
      mpesaCallback: { phone: "254700000000", receipt: "ABC" },
      activity: { name: "City tour", modalityName: "Morning" },
      cancellationPolicies: [{ amount: 10 }],
    },
  }) as Record<string, unknown>;

  assert.equal("metadata" in output, false);
  assert.equal("selectionToken" in output, false);
  assert.deepEqual(output.activity, { name: "City tour", modalityName: "Morning" });
  assert.deepEqual(output.cancellationPolicies, [{ amount: 10 }]);
});
