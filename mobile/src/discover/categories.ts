export type TravelCategoryKind =
  | "stay"
  | "experiences"
  | "safaris"
  | "events"
  | "food"
  | "transfers"
  | "drivers"
  | "adventure"
  | "wellness"
  | "activities"
  | "places";

export type TravelCategory = {
  kind: TravelCategoryKind;
  label: string;
  mark: string;
  blurb: string;
};

export const TRAVEL_CATEGORIES: TravelCategory[] = [
  { kind: "stay", label: "Stay", mark: "ST", blurb: "Hotels, resorts, villas and apartments." },
  { kind: "experiences", label: "Experiences", mark: "EX", blurb: "Tours, excursions and unique local experiences." },
  { kind: "safaris", label: "Safaris", mark: "SF", blurb: "Wildlife, parks, conservation and safari days." },
  { kind: "events", label: "Events", mark: "EV", blurb: "Concerts, festivals, nightlife and culture." },
  { kind: "food", label: "Food & Drink", mark: "FD", blurb: "Restaurants, dining experiences and culinary discovery." },
  { kind: "transfers", label: "Transfers", mark: "TR", blurb: "Airport, hotel and private transportation." },
  { kind: "drivers", label: "Drivers", mark: "DR", blurb: "Verified private drivers — never an unverified directory." },
  { kind: "adventure", label: "Adventure", mark: "AD", blurb: "Diving, watersports, hiking and instructors." },
  { kind: "wellness", label: "Wellness", mark: "WL", blurb: "Spa, beauty and personal services." },
  { kind: "activities", label: "Activities", mark: "AC", blurb: "Things to do locally." },
  { kind: "places", label: "Places", mark: "PL", blurb: "Destinations, attractions and neighborhoods." },
];

export function categoryByKind(kind: string): TravelCategory | undefined {
  return TRAVEL_CATEGORIES.find((row) => row.kind === kind);
}
