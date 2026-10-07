export type TravelReviewProduct = "hotel" | "activity" | "transfer";

type Metadata = Record<string, unknown>;

function record(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Metadata : {};
}

function dateValue(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function travelReviewCompletionTime(product: TravelReviewProduct, metadata: Metadata): number | null {
  if (product === "hotel") return dateValue(metadata.checkOut);
  if (product === "activity") {
    const activity = record(metadata.activity);
    return dateValue(activity.to) ?? dateValue(activity.from);
  }
  const route = record(metadata.route);
  const outbound = dateValue(route.outbound);
  const inbound = dateValue(route.inbound);
  if (outbound == null) return inbound;
  if (inbound == null) return outbound;
  return Math.max(outbound, inbound);
}

export function travelReviewEligible(input: {
  product: TravelReviewProduct;
  bookingStatus: string | null;
  paymentStatus: string | null;
  metadata: Metadata;
  nowMs?: number;
}) {
  if (input.bookingStatus !== "confirmed") return { eligible: false, reason: "Booking is not confirmed." };
  if (input.paymentStatus !== "paid") return { eligible: false, reason: "Booking payment is not settled." };
  const completion = travelReviewCompletionTime(input.product, input.metadata);
  if (completion == null) return { eligible: false, reason: "SafariPlug does not have a trustworthy completion date for this booking." };
  const nowMs = input.nowMs ?? Date.now();
  if (completion > nowMs) return { eligible: false, reason: "Review becomes available after the trip component is completed." };
  return { eligible: true, reason: "Completed verified SafariPlug booking." };
}

export const TRAVEL_REVIEW_DIMENSIONS: Record<TravelReviewProduct, string[]> = {
  hotel: ["cleanliness","service","location","value"],
  activity: ["experience","guide","logistics","value"],
  transfer: ["punctuality","driver","vehicle","safety"],
};
