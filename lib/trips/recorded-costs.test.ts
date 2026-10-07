import assert from "node:assert/strict";
import test from "node:test";
import { tripBudgetPosition, tripCostTotals } from "./recorded-costs";

test("totals currencies separately",()=>{
  const totals=tripCostTotals([
    {kind:"Stay",sourceId:"1",amount:10000,currency:"KES",status:"confirmed"},
    {kind:"Service",sourceId:"2",amount:5000,currency:"KES",status:"completed"},
    {kind:"External",sourceId:"3",amount:100,currency:"USD",status:"confirmed"},
  ]);
  assert.equal(totals.KES,15000);
  assert.equal(totals.USD,100);
});

test("computes remaining budget only in matching currency",()=>{
  const result=tripBudgetPosition({budgetAmount:50000,budgetCurrency:"KES",totals:{KES:17500,USD:200}});
  assert.equal(result?.remaining,32500);
  assert.equal(result?.overBudget,false);
});

test("reports over budget",()=>{
  const result=tripBudgetPosition({budgetAmount:10000,budgetCurrency:"KES",totals:{KES:12500}});
  assert.equal(result?.overBudget,true);
  assert.equal(result?.remaining,-2500);
});
