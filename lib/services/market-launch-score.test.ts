import assert from "node:assert/strict";
import test from "node:test";
import { marketLaunchScore } from "./market-launch-score";
import type { SupplyMarketRow } from "@/lib/services/supply-market-readiness";

function row(category:string,live:number,pipeline:number,target:number):SupplyMarketRow{
 return {city:"Diani",category:category as any,livePartners:live,pipeline,target,gap:Math.max(0,target-live),pipelineCoveredGap:Math.min(Math.max(0,target-live),pipeline),uncoveredGap:Math.max(0,target-live-pipeline),readiness:Math.min(100,Math.round(live/target*100))};
}

test("launch ready requires strong live coverage and no zero-live core category",()=>{
 const rows=[
  row("Hotels",3,0,3),row("Experiences",5,0,5),row("Restaurants",3,0,3),row("Airport Transfer Operators",3,0,3),row("Tours & Local Guides",3,0,3),
 ];
 const score=marketLaunchScore("Diani",rows);
 assert.equal(score.status,"launch_ready");
 assert.equal(score.score,100);
});

test("pipeline helps but does not replace live supply",()=>{
 const rows=[
  row("Hotels",0,3,3),row("Experiences",0,5,5),row("Restaurants",0,3,3),row("Airport Transfer Operators",0,3,3),row("Tours & Local Guides",0,3,3),
 ];
 const score=marketLaunchScore("Diani",rows);
 assert.equal(score.pipelineCoverage,100);
 assert.equal(score.status,"thin");
 assert.ok(score.score<35);
});
