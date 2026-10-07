import assert from "node:assert/strict";
import test from "node:test";
import { budgetFit, eventFitsBusyWindows } from "./live-recommendations";

test("event conflicts with recorded busy window",()=>{
  assert.equal(eventFitsBusyWindows(
    {start_at:"2026-10-10T10:00:00Z",end_at:"2026-10-10T12:00:00Z"},
    [{start:"2026-10-10T11:00:00Z",end:"2026-10-10T13:00:00Z"}]
  ),false);
});

test("event outside busy window fits",()=>{
  assert.equal(eventFitsBusyWindows(
    {start_at:"2026-10-10T14:00:00Z",end_at:"2026-10-10T16:00:00Z"},
    [{start:"2026-10-10T11:00:00Z",end:"2026-10-10T13:00:00Z"}]
  ),true);
});

test("budget comparison only applies in matching currency",()=>{
  assert.equal(budgetFit(5000,"KES",{remaining:7000,currency:"KES"}),true);
  assert.equal(budgetFit(9000,"KES",{remaining:7000,currency:"KES"}),false);
  assert.equal(budgetFit(100,"USD",{remaining:7000,currency:"KES"}),null);
});
