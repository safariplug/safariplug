export type SupplierPerformanceScoreInput = {
  bookingStatusOpen: boolean;
  activeAvailabilityCount: number;
  payoutAccountVerified: boolean;
  payoutIssueCount: number;
  completed: number;
  cancelled: number;
  noShow: number;
  openQualityIssues: number;
};

export function supplierPerformanceScore(input: SupplierPerformanceScoreInput) {
  const outcomes = input.completed + input.cancelled + input.noShow;
  const completionRate = outcomes > 0 ? Math.round((input.completed / outcomes) * 100) : null;
  const failureRate = outcomes > 0 ? Math.round(((input.cancelled + input.noShow) / outcomes) * 100) : null;
  let score = 0;
  score += input.bookingStatusOpen ? 25 : 0;
  score += input.activeAvailabilityCount > 0 ? 15 : 0;
  if (completionRate == null) score += 15;
  else score += Math.round((completionRate / 100) * 30);
  if (failureRate == null) score += 10;
  else if (failureRate <= 10) score += 20;
  else if (failureRate < 50) score += Math.max(0, Math.round(20 * (1 - (failureRate - 10) / 40)));
  if (input.payoutAccountVerified && input.payoutIssueCount === 0) score += 10;
  else if (input.payoutAccountVerified) score += 5;
  score -= Math.min(20, input.openQualityIssues * 5);
  score = Math.max(0, Math.min(100, score));
  const band = score >= 85 ? "strong" : score >= 70 ? "healthy" : score >= 50 ? "watch" : "attention";
  return { score, band, completionRate, failureRate, outcomes };
}


export type SupplierGrowthRecommendationInput = {
  score: number;
  bookingStatusOpen: boolean;
  activeAvailabilityCount: number;
  activeOfferingCount: number;
  bookings30d: number;
  completionRate: number | null;
  failureRate: number | null;
  payoutIssueCount: number;
  openQualityIssues: number;
};

export type SupplierGrowthRecommendation = {
  key: "restore_bookability" | "increase_availability" | "add_offerings" | "improve_fulfilment" | "resolve_payouts" | "promote_supplier" | "build_demand";
  title: string;
  detail: string;
  priority: "high" | "normal" | "growth";
};

export function supplierGrowthRecommendations(input: SupplierGrowthRecommendationInput): SupplierGrowthRecommendation[] {
  const recommendations: SupplierGrowthRecommendation[] = [];

  if (!input.bookingStatusOpen) {
    recommendations.push({
      key: "restore_bookability",
      title: "Restore bookability",
      detail: "This supplier is approved/live but customer bookings are not fully open. Resolve the operating blocker before investing in demand generation.",
      priority: "high",
    });
  }

  if (input.activeAvailabilityCount === 0) {
    recommendations.push({
      key: "increase_availability",
      title: "Reopen availability",
      detail: "No active availability is visible. Ask the supplier to reopen bookable slots or confirm whether the pause is intentional.",
      priority: "high",
    });
  } else if (input.activeAvailabilityCount < 3 && input.bookingStatusOpen) {
    recommendations.push({
      key: "increase_availability",
      title: "Increase availability",
      detail: "Bookability is open, but active availability is thin. More bookable slots can improve the chance of converting traveler demand.",
      priority: "normal",
    });
  }

  if (input.activeOfferingCount < 2) {
    recommendations.push({
      key: "add_offerings",
      title: "Add more bookable offerings",
      detail: "The supplier has limited active inventory. Review whether additional relevant services or packages can be published.",
      priority: "growth",
    });
  }

  if (input.failureRate != null && input.failureRate >= 25) {
    recommendations.push({
      key: "improve_fulfilment",
      title: "Improve fulfilment reliability",
      detail: `Cancellation/no-show rate is ${input.failureRate}% over recorded recent outcomes. Review the causes before increasing promotion.`,
      priority: "high",
    });
  }

  if (input.payoutIssueCount > 0) {
    recommendations.push({
      key: "resolve_payouts",
      title: "Resolve payout exceptions",
      detail: `${input.payoutIssueCount} recent payout exception${input.payoutIssueCount === 1 ? "" : "s"} may weaken the supplier relationship. Clear finance issues before scaling the partnership.`,
      priority: "high",
    });
  }

  const operationallyStrong =
    input.score >= 85 &&
    input.bookingStatusOpen &&
    input.activeAvailabilityCount >= 3 &&
    input.openQualityIssues === 0 &&
    input.payoutIssueCount === 0 &&
    (input.failureRate == null || input.failureRate <= 10);

  if (operationallyStrong && input.bookings30d >= 3) {
    recommendations.push({
      key: "promote_supplier",
      title: "Prioritize for promotion",
      detail: "This supplier is operating strongly. Consider stronger merchandising, campaign placement, trip recommendations, or account-growth conversations.",
      priority: "growth",
    });
  } else if (
    input.bookingStatusOpen &&
    input.activeAvailabilityCount > 0 &&
    input.bookings30d === 0 &&
    input.openQualityIssues === 0 &&
    input.payoutIssueCount === 0
  ) {
    recommendations.push({
      key: "build_demand",
      title: "Build demand for healthy inventory",
      detail: "The supplier is operationally ready but has no recorded service bookings in the last 30 days. Review discovery placement, content quality, pricing, and campaign fit.",
      priority: "growth",
    });
  }

  return recommendations.sort((a, b) => {
    const rank = { high: 0, normal: 1, growth: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });
}
