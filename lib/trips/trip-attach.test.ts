import assert from "node:assert/strict";
import test from "node:test";
import { tripAttachRecommendations } from "./trip-attach";

test("prioritizes missing stay and transfer", () => {
  const result = tripAttachRecommendations({
    tripId: "trip-1",
    hasStay: false,
    hasTransfer: false,
    hasActivityOrEvent: true,
    hasService: false,
    hasFood: false,
  });
  assert.equal(result[0].key, "stay");
  assert.equal(result[1].key, "transfer");
  assert.match(result[0].href, /tripId=trip-1/);
});

test("does not recommend categories already attached", () => {
  const result = tripAttachRecommendations({
    tripId: "trip-2",
    hasStay: true,
    hasTransfer: true,
    hasActivityOrEvent: true,
    hasService: true,
    hasFood: false,
  });
  assert.deepEqual(result.map((item)=>item.key), ["food"]);
});
