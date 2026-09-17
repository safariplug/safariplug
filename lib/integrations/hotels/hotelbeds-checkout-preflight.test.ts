import assert from "node:assert/strict";
import { test } from "node:test";
import { assertHotelbedsPreflightAccepted, mergeHotelbedsNotices } from "./hotelbeds-checkout-preflight";

test("Hotelbeds preflight notice merge preserves order and removes duplicates", () => {
  assert.deepEqual(
    mergeHotelbedsNotices(["Breakfast included", "City tax payable locally"], ["City tax payable locally", "Late arrival notice"]),
    ["Breakfast included", "City tax payable locally", "Late arrival notice"]
  );
});

test("Hotelbeds payment requires preflight and traveler acceptance", () => {
  assert.throws(() => assertHotelbedsPreflightAccepted({ preflighted: false, termsAccepted: true, rateType: "BOOKABLE" }), /preflight/i);
  assert.throws(() => assertHotelbedsPreflightAccepted({ preflighted: true, termsAccepted: false, rateType: "BOOKABLE" }), /accept/i);
  assert.doesNotThrow(() => assertHotelbedsPreflightAccepted({ preflighted: true, termsAccepted: true, rateType: "BOOKABLE", checkRateCompleted: false }));
});

test("Hotelbeds RECHECK payment requires preflight CheckRate completion", () => {
  assert.throws(() => assertHotelbedsPreflightAccepted({ preflighted: true, termsAccepted: true, rateType: "RECHECK", checkRateCompleted: false }), /CheckRate/);
  assert.doesNotThrow(() => assertHotelbedsPreflightAccepted({ preflighted: true, termsAccepted: true, rateType: "RECHECK", checkRateCompleted: true }));
});
