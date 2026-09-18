import assert from "node:assert/strict";
import { test } from "node:test";
import { publicTransferCheckoutLedger } from "./transfer-public-ledger";

test("public transfer ledger excludes booking request and customer PII", () => {
  const output = publicTransferCheckoutLedger({
    id: "ledger-1",
    prepared_booking_id: "hotelbeds-transfer-1",
    provider_booking_reference: "HB-123",
    customer_currency: "KES",
    retail_amount: 1000,
    payment_status: "paid",
    booking_status: "confirmed",
    supplier_settlement_status: "settled",
    metadata: {
      selectionToken: "secret-selection",
      holder: { name: "Jane", phone: "+254700000000" },
      bookingRequest: { transfers: [{ rateKey: "RATE-SECRET" }] },
      mpesaCallback: { phone: "254700000000", receipt: "ABC" },
      route: { from: { code: "NBO" }, to: { code: "HOTEL" } },
      service: { vehicleName: "Sedan" },
      cancellationPolicies: [{ amount: 10 }],
    },
  }) as Record<string, unknown>;

  assert.equal("metadata" in output, false);
  assert.equal("selectionToken" in output, false);
  assert.deepEqual(output.route, { from: { code: "NBO" }, to: { code: "HOTEL" } });
  assert.deepEqual(output.service, { vehicleName: "Sedan" });
});
