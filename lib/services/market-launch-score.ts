import type { SupplyMarketRow } from "@/lib/services/supply-market-readiness";

export type MarketLaunchScore = {
  city: string;
  score: number;
  liveCoverage: number;
  pipelineCoverage: number;
  zeroLiveCategories: number;
  status: "launch_ready" | "nearly_ready" | "building" | "thin";
  strongestCategory: string | null;
  weakestCategory: string | null;
};

export function marketLaunchScore(city: string, rows: SupplyMarketRow[]): MarketLaunchScore {
  const items = rows.filter((row) => row.city === city);
  if (!items.length) {
    return { city, score: 0, liveCoverage: 0, pipelineCoverage: 0, zeroLiveCategories: 0, status: "thin", strongestCategory: null, weakestCategory: null };
  }

  const liveCoverage = Math.round(items.reduce((sum,row)=>sum+Math.min(1,row.livePartners/row.target),0)/items.length*100);
  const pipelineCoverage = Math.round(items.reduce((sum,row)=>sum+Math.min(1,(row.livePartners+row.pipeline)/row.target),0)/items.length*100);
  const zeroLiveCategories = items.filter((row)=>row.livePartners===0).length;
  const penalty = Math.min(20, zeroLiveCategories * 4);
  const raw = Math.round(liveCoverage * 0.75 + pipelineCoverage * 0.25);
  const score = Math.max(0, raw - penalty);

  const sorted=[...items].sort((a,b)=>(b.livePartners/b.target)-(a.livePartners/a.target));
  const strongestCategory=sorted[0]?.category||null;
  const weakestCategory=sorted[sorted.length-1]?.category||null;

  const status = score >= 85 && zeroLiveCategories===0 ? "launch_ready"
    : score >= 65 ? "nearly_ready"
    : score >= 35 ? "building"
    : "thin";

  return { city, score, liveCoverage, pipelineCoverage, zeroLiveCategories, status, strongestCategory, weakestCategory };
}

export function rankMarketLaunchScores(rows: SupplyMarketRow[]) {
  const cities=[...new Set(rows.map((row)=>row.city))];
  return cities.map((city)=>marketLaunchScore(city,rows)).sort((a,b)=>b.score-a.score||a.city.localeCompare(b.city));
}
