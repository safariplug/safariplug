import assert from "node:assert/strict";
import test from "node:test";

test("destination density thresholds remain explicit",()=>{
  const density=(n:number)=>n>=20?"strong":n>=8?"building":"thin";
  assert.equal(density(3),"thin");
  assert.equal(density(8),"building");
  assert.equal(density(20),"strong");
});
