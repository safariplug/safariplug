export const SUPPLY_CORE_CATEGORIES = [
  "Hotels",
  "Experiences",
  "Restaurants",
  "Airport Transfer Operators",
  "Tours & Local Guides",
] as const;

export type SupplyCoreCategory = (typeof SUPPLY_CORE_CATEGORIES)[number];

export const SUPPLY_LAUNCH_TARGETS: Record<SupplyCoreCategory, number> = {
  Hotels: 3,
  Experiences: 5,
  Restaurants: 3,
  "Airport Transfer Operators": 3,
  "Tours & Local Guides": 3,
};

export type SupplyMarketRow = {
  city: string;
  category: SupplyCoreCategory;
  livePartners: number;
  pipeline: number;
  target: number;
  gap: number;
  readiness: number;
};

export function supplyMarketReadiness(input: {
  cities: string[];
  prospects: Array<{ city: string | null; category: string | null; review_status?: string | null; status?: string | null }>;
  activatedPartners: Array<{ city: string | null; category: string | null }>;
}) {
  const rows: SupplyMarketRow[] = [];

  for (const city of input.cities) {
    for (const category of SUPPLY_CORE_CATEGORIES) {
      const target = SUPPLY_LAUNCH_TARGETS[category];
      const livePartners = input.activatedPartners.filter((row) => row.city === city && row.category === category).length;
      const pipeline = input.prospects.filter((row) =>
        row.city === city &&
        row.category === category &&
        row.status !== "rejected"
      ).length;
      const gap = Math.max(0, target - livePartners);
      const readiness = Math.min(100, Math.round((livePartners / target) * 100));
      rows.push({ city, category, livePartners, pipeline, target, gap, readiness });
    }
  }

  return rows;
}

export function citySupplySummary(rows: SupplyMarketRow[]) {
  const grouped = new Map<string, SupplyMarketRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.city) || [];
    list.push(row);
    grouped.set(row.city, list);
  }

  return [...grouped.entries()].map(([city, items]) => {
    const totalTarget = items.reduce((sum, item) => sum + item.target, 0);
    const totalLive = items.reduce((sum, item) => sum + Math.min(item.livePartners, item.target), 0);
    const totalGap = items.reduce((sum, item) => sum + item.gap, 0);
    const pipeline = items.reduce((sum, item) => sum + item.pipeline, 0);
    const readiness = totalTarget ? Math.round((totalLive / totalTarget) * 100) : 0;
    const status = readiness >= 100 ? "launch_ready" : readiness >= 60 ? "building" : "thin";
    return { city, readiness, status, totalGap, pipeline, items };
  }).sort((a,b)=>b.readiness-a.readiness||a.city.localeCompare(b.city));
}

export function supplyGapPriority(rows: SupplyMarketRow[]) {
  return [...rows]
    .filter((row) => row.gap > 0)
    .sort((a,b) => {
      const gapRatioA = a.gap / a.target;
      const gapRatioB = b.gap / b.target;
      return gapRatioB - gapRatioA || b.gap - a.gap || a.city.localeCompare(b.city) || a.category.localeCompare(b.category);
    });
}
