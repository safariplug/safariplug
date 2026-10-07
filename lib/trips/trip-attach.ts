export type TripAttachInput = {
  hasStay: boolean;
  hasTransfer: boolean;
  hasActivityOrEvent: boolean;
  hasService: boolean;
  hasFood: boolean;
  tripId: string;
};

export type TripAttachRecommendation = {
  key: "stay" | "transfer" | "activity" | "service" | "food";
  title: string;
  detail: string;
  href: string;
  priority: number;
};

export function tripAttachRecommendations(input: TripAttachInput): TripAttachRecommendation[] {
  const id = encodeURIComponent(input.tripId);
  const recommendations: TripAttachRecommendation[] = [];

  if (!input.hasStay) recommendations.push({
    key: "stay",
    title: "Add a stay",
    detail: "Search live hotel inventory and keep the confirmed booking attached to this trip.",
    href: `/hotels?tripId=${id}`,
    priority: 1,
  });

  if (!input.hasTransfer) recommendations.push({
    key: "transfer",
    title: "Plan your transfer",
    detail: "Add airport, hotel or point-to-point transport for this journey.",
    href: `/transfers?tripId=${id}`,
    priority: 2,
  });

  if (!input.hasActivityOrEvent) recommendations.push({
    key: "activity",
    title: "Add something to do",
    detail: "Browse live activities and approved experiences for the open time in your itinerary.",
    href: `/activities?tripId=${id}`,
    priority: 3,
  });

  if (!input.hasService) recommendations.push({
    key: "service",
    title: "Add a useful local service",
    detail: "Find bookable personal services such as wellness, beauty, fitness or local specialists.",
    href: `/services?tripId=${id}`,
    priority: 4,
  });

  if (!input.hasFood) recommendations.push({
    key: "food",
    title: "Add food to the trip",
    detail: "Browse restaurants with live menus or ordering when available.",
    href: `/restaurants?tripId=${id}`,
    priority: 5,
  });

  return recommendations.sort((a,b)=>a.priority-b.priority).slice(0,4);
}
