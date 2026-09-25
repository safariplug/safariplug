import test from "node:test";
import assert from "node:assert/strict";
import { scoreProspect } from "../../app/admin/ai-sales/actions/scoring";

test("Supplier Scout scoring prioritizes high-value launch-market combinations", () => {
  const hotel = scoreProspect({ business_name: "Hotel", category: "Hotels", city: "Nairobi" });
  assert.equal(hotel.score, 85);
  assert.equal(hotel.priority, "High");

  const water = scoreProspect({ business_name: "Water", category: "Water Sports & Kite", city: "Mombasa" });
  assert.ok(water.score >= 85);
  assert.equal(water.priority, "High");
});

test("Supplier Scout scoring keeps priority-market personal services actionable", () => {
  const barber = scoreProspect({ business_name: "Barber", category: "Barbers", city: "Nairobi" });
  assert.ok(barber.score >= 70);
  assert.equal(barber.priority, "Medium");
});

test("Supplier Scout scoring avoids low-fit scheduled combinations", () => {
  const inlandWater = scoreProspect({ business_name: "Water", category: "Water Sports & Kite", city: "Johannesburg" });
  assert.ok(inlandWater.score < 70);
  assert.equal(inlandWater.priority, "Low");
});
