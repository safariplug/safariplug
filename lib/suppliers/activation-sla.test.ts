import assert from "node:assert/strict";
import test from "node:test";
import { supplierActivationSla } from "./activation-sla";

const now=Date.parse("2026-10-07T22:00:00Z");

test("submitted supplier becomes overdue after 24 hours",()=>{
 const result=supplierActivationSla({onboardingStatus:"submitted",submittedAt:"2026-10-06T20:00:00Z",nowMs:now});
 assert.equal(result.key,"overdue");
 assert.equal(result.owner,"staff");
});

test("submitted supplier is due soon at 18 hours",()=>{
 const result=supplierActivationSla({onboardingStatus:"submitted",submittedAt:"2026-10-07T04:00:00Z",nowMs:now});
 assert.equal(result.key,"due_soon");
});

test("changes requested remains supplier-owned",()=>{
 const result=supplierActivationSla({onboardingStatus:"changes_requested",reviewRequestedAt:"2026-10-07T10:00:00Z",nowMs:now});
 assert.equal(result.owner,"supplier");
 assert.equal(result.key,"waiting_supplier");
});
