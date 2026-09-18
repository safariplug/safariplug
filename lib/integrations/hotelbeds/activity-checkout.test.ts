import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  activityBookingReference,
  activityBookingStatus,
  buildHotelbedsActivityBookingRequest,
  extractHotelbedsActivitySelections,
  normalizeActivityAnswers,
  normalizeActivityHolder,
  normalizeActivityPaxes,
  sanitizeHotelbedsActivitySearch,
} from "./activity-checkout";
import {
  openHotelbedsActivitySelectionToken,
  sealHotelbedsActivitySelectionToken,
} from "./activity-selection-token";

const originalSecret = process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_SECRET;
process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_SECRET = "test-activities-secret";

after(() => {
  if (originalSecret === undefined) delete process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_SECRET;
  else process.env.SAFARIPLUG_HOTELBEDS_ACTIVITIES_SECRET = originalSecret;
});

test("activity selection token round-trips and expires", () => {
  const token = sealHotelbedsActivitySelectionToken(
    {
      activityCode: "ACT-1",
      activityName: "City tour",
      modalityCode: "MOD-1",
      modalityName: "Morning tour",
      rateKey: "RATE-1",
      from: "2026-10-10",
      to: "2026-10-10",
      paxes: [{ age: 35 }, { age: 8 }],
      supplierAmount: 100,
      supplierCurrency: "EUR",
      rateClass: "NOR",
      freeCancellation: true,
      cancellationPolicies: [],
      questions: [],
      comments: [],
    },
    1000,
    600
  );

  const opened = openHotelbedsActivitySelectionToken(token, 1100);
  assert.equal(opened.rateKey, "RATE-1");
  assert.equal(opened.paxes.length, 2);
  assert.throws(() => openHotelbedsActivitySelectionToken(token, 1601), /expired/);
});

test("search response is sanitized into customer cards", () => {
  const results = sanitizeHotelbedsActivitySearch({
    activities: [
      {
        code: "ACT-1",
        name: "City tour",
        currency: "EUR",
        amountsFrom: [{ paxType: "ADULT", amount: 45 }],
        content: { description: "Explore the city." },
      },
    ],
  });
  assert.deepEqual(results, [
    {
      code: "ACT-1",
      name: "City tour",
      description: "Explore the city.",
      currency: "EUR",
      imageUrl: null,
      amountsFrom: [{ paxType: "ADULT", ageFrom: null, ageTo: null, amount: 45 }],
    },
  ]);
});

test("details response produces governed rate selections", () => {
  const results = extractHotelbedsActivitySelections(
    {
      activity: {
        code: "ACT-1",
        name: "City tour",
        currency: "EUR",
        modalities: [
          {
            code: "MORNING",
            name: "Morning tour",
            questions: [{ code: "HOTEL", text: "Hotel name?", required: true }],
            comments: [{ type: "CONTRACT_REMARKS", text: "Bring ID." }],
            rates: [
              {
                rateClass: "NOR",
                freeCancellation: false,
                rateDetails: [
                  {
                    rateKey: "RATE-ABC",
                    totalAmount: { amount: 130 },
                    operationDates: [
                      {
                        from: "2026-10-10",
                        to: "2026-10-10",
                        cancellationPolicies: [{ dateFrom: "2026-10-09", amount: 130 }],
                      },
                    ],
                    sessions: [{ code: "AM", name: "10:00" }],
                    languages: [{ code: "en", name: "English" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    [{ age: 35 }, { age: 8 }]
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].supplierAmount, 130);
  assert.equal(results[0].session?.code, "AM");
  const token = openHotelbedsActivitySelectionToken(results[0].selectionToken);
  assert.equal(token.activityCode, "ACT-1");
  assert.equal(token.questions?.[0].code, "HOTEL");
});

test("participant and answers validation preserves ages", () => {
  const holder = normalizeActivityHolder({
    name: "Jane",
    surname: "Doe",
    email: "jane@example.com",
    phone: "+254700000000",
  });
  const paxes = normalizeActivityPaxes(
    [{ age: 35 }, { age: 8 }],
    [
      { name: "Jane", surname: "Doe" },
      { name: "Alex", surname: "Doe" },
    ]
  );
  const answers = normalizeActivityAnswers(
    [{ code: "HOTEL", text: "Hotel name?", required: true }],
    [{ code: "HOTEL", answer: "Safari Lodge" }]
  );

  const request = buildHotelbedsActivityBookingRequest({
    selection: {
      activityCode: "ACT-1",
      activityName: "City tour",
      modalityCode: "MORNING",
      modalityName: "Morning",
      rateKey: "RATE-1",
      from: "2026-10-10",
      to: "2026-10-10",
      paxes: [{ age: 35 }, { age: 8 }],
      supplierAmount: 130,
      supplierCurrency: "EUR",
      sessionCode: "AM",
      languageCode: "en",
      questions: [{ code: "HOTEL", text: "Hotel name?", required: true }],
      issuedAt: 1000,
      expiresAt: 1600,
    },
    holder,
    paxes,
    answers,
    clientReference: "SPA-TEST-1",
  });

  assert.equal(request.activities[0].rateKey, "RATE-1");
  assert.equal(request.activities[0].session, "AM");
  assert.equal(request.activities[0].language, "en");
  assert.equal(request.activities[0].paxes[0].type, "ADULT");
  assert.equal(request.activities[0].paxes[1].type, "CHILD");
  assert.equal(request.activities[0].answers?.[0].answer, "Safari Lodge");
});

test("booking reference and status are read from Hotelbeds booking response", () => {
  const payload = { booking: { reference: "102-12345", status: "CONFIRMED" } };
  assert.equal(activityBookingReference(payload), "102-12345");
  assert.equal(activityBookingStatus(payload), "CONFIRMED");
});
