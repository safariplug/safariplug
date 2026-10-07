import assert from "node:assert/strict";
import test from "node:test";
import { citySupplySummary, supplyGapPriority, supplyMarketReadiness } from "./supply-market-readiness";

test("computes city/category supply gaps", () => {
  const rows = supplyMarketReadiness({
    cities: ["Diani"],
    prospects: [
      { city: "Diani", category: "Hotels" },
      { city: "Diani", category: "Restaurants" },
    ],
    activatedPartners: [
      { city: "Diani", category: "Hotels" },
      { city: "Diani", category: "Hotels" },
      { city: "Diani", category: "Restaurants" },
    ],
  });
  const hotels = rows.find((row)=>row.category==="Hotels");
  assert.equal(hotels?.livePartners, 2);
  assert.equal(hotels?.gap, 1);
  assert.equal(hotels?.readiness, 67);
});

test("prioritizes the largest relative gap", () => {
  const rows = supplyMarketReadiness({
    cities: ["Diani"],
    prospects: [],
    activatedPartners: [{ city: "Diani", category: "Hotels" }],
  });
  const prioritized = supplyGapPriority(rows);
  assert.ok(prioritized.length > 0);
  assert.equal(prioritized[0].gap > 0, true);
});

test("summarizes city launch readiness", () => {
  const rows = supplyMarketReadiness({
    cities: ["Diani"],
    prospects: [],
    activatedPartners: [],
  });
  const summary = citySupplySummary(rows)[0];
  assert.equal(summary.city, "Diani");
  assert.equal(summary.status, "thin");
  assert.equal(summary.readiness, 0);
});
