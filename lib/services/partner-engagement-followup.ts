export type PartnerEngagementEvent = "opened" | "clicked";

export function partnerEngagementFollowup(event: PartnerEngagementEvent, nowMs = Date.now()) {
  const delayHours = event === "clicked" ? 24 : 48;
  return {
    title: event === "clicked"
      ? "Follow up after partner invitation click"
      : "Follow up after partner invitation open",
    dueAt: new Date(nowMs + delayHours * 60 * 60 * 1000).toISOString(),
    priority: event === "clicked" ? "high" : "normal",
    note: event === "clicked"
      ? "The partner clicked the SafariPlug invitation but has not started onboarding yet. Review the organization context and prepare a concise human follow-up if appropriate."
      : "The partner opened the SafariPlug invitation but has not started onboarding yet. Review the organization context before any follow-up.",
  };
}

export function earlierDueAt(current: string | null | undefined, candidate: string) {
  if (!current) return candidate;
  const currentMs = Date.parse(current);
  const candidateMs = Date.parse(candidate);
  if (!Number.isFinite(currentMs)) return candidate;
  if (!Number.isFinite(candidateMs)) return current;
  return candidateMs < currentMs ? candidate : current;
}
