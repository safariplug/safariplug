import assert from "node:assert/strict";
import test from "node:test";
import { isServiceAppointmentPayableStatus } from "./service-eligibility";

test("confirmed service appointments are payable", () => {
  assert.equal(isServiceAppointmentPayableStatus("confirmed"), true);
});

test("provider-confirmation requests are not payable while pending", () => {
  assert.equal(isServiceAppointmentPayableStatus("pending"), false);
});

test("terminal or fulfillment statuses are not new-payment entry points", () => {
  for (const status of ["cancelled", "completed", "no_show", "checked_in", "in_progress"]) {
    assert.equal(isServiceAppointmentPayableStatus(status), false, status);
  }
});
