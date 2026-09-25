import assert from "node:assert/strict";
import test from "node:test";
import { eligibleDriverRequestVehicles, knownDriverRequestCapacity } from "./driver-request-eligibility";

test("driver request vehicles must be active and compliance-current", () => {
  const vehicles = eligibleDriverRequestVehicles([
    { id: "ok", status: "active", passenger_capacity: 4, registration_compliance_status: "valid", insurance_compliance_status: "expiring_soon" },
    { id: "inactive", status: "inactive", passenger_capacity: 8, registration_compliance_status: "valid", insurance_compliance_status: "valid" },
    { id: "expired", status: "active", passenger_capacity: 6, registration_compliance_status: "expired", insurance_compliance_status: "valid" },
  ]);
  assert.deepEqual(vehicles.map((vehicle) => vehicle.id), ["ok"]);
});

test("known capacity uses the largest eligible vehicle when every capacity is known", () => {
  assert.equal(knownDriverRequestCapacity([
    { id: "a", passenger_capacity: 4 },
    { id: "b", passenger_capacity: 7 },
  ]), 7);
});

test("unknown vehicle capacity does not create a false rejection", () => {
  assert.equal(knownDriverRequestCapacity([
    { id: "a", passenger_capacity: 4 },
    { id: "b", passenger_capacity: null },
  ]), null);
});
