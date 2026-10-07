import assert from "node:assert/strict";
import test from "node:test";
import { supplierQualityDueAt, supplierQualityRecovery } from "./supplier-quality-recovery";

test("bookings closed creates urgent 24h recovery", () => {
  const recovery = supplierQualityRecovery("bookings_closed");
  assert.equal(recovery.priority, "high");
  assert.equal(recovery.title, "[Supplier quality] Reopen supplier bookings");
  assert.equal(
    supplierQualityDueAt(recovery, Date.parse("2026-10-07T12:00:00.000Z")),
    "2026-10-08T12:00:00.000Z",
  );
});

test("availability recovery allows 48h", () => {
  const recovery = supplierQualityRecovery("no_active_availability");
  assert.equal(recovery.priority, "normal");
  assert.equal(recovery.dueHours, 48);
});
