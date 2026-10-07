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
