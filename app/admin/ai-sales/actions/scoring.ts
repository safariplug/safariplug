export type ScoringInput = {
  business_name: string;
  category: string;
  city: string;
};

export type ScoringResult = {
  score: number;
  priority: "High" | "Medium" | "Low";
  reason: string;
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  Hotels: 25,
  Experiences: 20,
  "Tour Operators": 18,
  "Tours & Local Guides": 18,
  "Beach Clubs": 18,
  "Diving & Marine": 16,
  "Water Sports & Kite": 16,
  "Surfing & Board Sports": 14,
  "Spas & Massage": 15,
  Restaurants: 15,
  Nightlife: 15,
  Barbers: 12,
  "Hair & Beauty": 12,
  "Tattoo Artists & Body Art": 12,
  Nails: 12,
  "Lashes & Brows": 10,
  "Fitness & Personal Training": 10,
  "Yoga/Pilates/Mindfulness": 10,
  "Private Chefs & Cooking": 10,
  "Photography & Content": 8,
};

const PRIORITY_CITY_WEIGHTS: Record<string, number> = {
  Nairobi: 10,
  Mombasa: 10,
  Diani: 10,
  Kilifi: 8,
  Malindi: 8,
  Watamu: 8,
  Lamu: 8,
  Zanzibar: 8,
  Kampala: 6,
};

const COASTAL_CITIES = new Set(["Mombasa", "Diani", "Kilifi", "Malindi", "Watamu", "Lamu", "Zanzibar"]);
const COASTAL_CATEGORIES = new Set(["Beach Clubs", "Diving & Marine", "Surfing & Board Sports", "Water Sports & Kite"]);

export function scoreProspect(prospect: ScoringInput): ScoringResult {
  let score = 50;
  const reasons: string[] = [];

  const categoryWeight = CATEGORY_WEIGHTS[prospect.category] || 0;
  if (categoryWeight) {
    score += categoryWeight;
    reasons.push("Marketplace-priority supplier category");
  }

  const cityWeight = PRIORITY_CITY_WEIGHTS[prospect.city] || 0;
  if (cityWeight) {
    score += cityWeight;
    reasons.push("Priority SafariPlug growth market");
  }

  if (COASTAL_CITIES.has(prospect.city) && COASTAL_CATEGORIES.has(prospect.category)) {
    score += 12;
    reasons.push("Strong coastal destination fit");
  }

  score = Math.min(score, 100);
  const priority: ScoringResult["priority"] = score >= 85 ? "High" : score >= 70 ? "Medium" : "Low";

  return {
    score,
    priority,
    reason: reasons.length ? reasons.join(". ") : "General discovery prospect",
  };
}
