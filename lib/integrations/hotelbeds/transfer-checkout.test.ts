import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHotelbedsTransferBookingRequest,
  extractHotelbedsTransferSelections,
  normalizeHotelbedsTransferHolder,
} from "./transfer-checkout";
import {
  openHotelbedsTransferSelectionToken,
  sealHotelbedsTransferSelectionToken,
} from "./transfer-selection-token";

const originalSecret = process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET;
process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET = "test-transfer-secret";

test.after(() => {
  if (originalSecret === undefined) delete process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET;
  else process.env.SAFARIPLUG_HOTELBEDS_TRANSFERS_SECRET = originalSecret;
});

test("Hotelbeds transfer selection token round-trips and expires", () => {
  const token = sealHotelbedsTransferSelectionToken(
    {
      rateKey: "RATE-123",
      supplierAmount: 24.28,
      supplierCurrency: "EUR",
      fromType: "IATA",
      fromCode: "BCN",
      toType: "ATLAS",
      toCode: "57",
      outbound: "2026-10-10T10:00:00",
      inbound: null,
      adults: 2,
      children: 0,
      infants: 0,
      cancellationPolicies: [],
      serviceSummary: { transferType: "PRIVATE" },
    },
    1_000,
    600
  );

  const opened = openHotelbedsTransferSelectionToken(token, 1_100);
  assert.equal(opened.rateKey, "RATE-123");
  assert.equal(opened.supplierAmount, 24.28);
  assert.equal(opened.supplierCurrency, "EUR");
  assert.throws(
    () => openHotelbedsTransferSelectionToken(token, 1_601),
    /expired/
  );
});

test("availability selections retain supplier rate key and price server-side", () => {
  const selections = extractHotelbedsTransferSelections(
    {
      services: [
        {
          rateKey: "RATE-ABC",
          price: { totalAmount: 64.7, currencyId: "EUR" },
          transferType: "PRIVATE",
          vehicle: { name: "Sedan", maxPaxCapacity: 3 },
          cancellationPolicies: [
            { amount: 64.7, from: "2026-10-09T10:00:00", currencyId: "EUR" },
          ],
        },
      ],
    },
    {
      fromType: "IATA",
      fromCode: "BCN",
      toType: "ATLAS",
      toCode: "651",
      outbound: "2026-10-10T10:00:00",
      adults: 2,
      children: 0,
      infants: 0,
    }
  );

  assert.equal(selections.length, 1);
  assert.equal(selections[0].rateKey, "RATE-ABC");
  assert.equal(selections[0].supplierAmount, 64.7);
  const opened = openHotelbedsTransferSelectionToken(selections[0].token);
  assert.equal(opened.toCode, "651");
  assert.equal(opened.serviceSummary?.vehicleName, "Sedan");
});

test("booking request requires governed holder fields and keeps one selected rate key", () => {
  const holder = normalizeHotelbedsTransferHolder({
    name: "Jane",
    surname: "Doe",
    email: "jane@example.com",
    phone: "+254700000000",
  });
  const request = buildHotelbedsTransferBookingRequest({
    rateKey: "RATE-XYZ",
    holder,
    transferDetails: [
      {
        type: "FLIGHT",
        direction: "ARRIVAL",
        code: "KQ100",
        companyName: "Kenya Airways",
      },
    ],
    clientReference: "SPT-TEST-1",
  });

  assert.deepEqual(request.holder, holder);
  assert.equal(request.clientReference, "SPT-TEST-1");
  assert.equal(request.transfers.length, 1);
  assert.equal(request.transfers[0].rateKey, "RATE-XYZ");
  assert.equal(Array.isArray(request.transfers[0].transferDetails), true);
});

test("holder phone must be E.164", () => {
  assert.throws(
    () =>
      normalizeHotelbedsTransferHolder({
        name: "Jane",
        surname: "Doe",
        email: "jane@example.com",
        phone: "0700000000",
      }),
    /E\.164/
  );
});
