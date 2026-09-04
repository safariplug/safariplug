export type AvailabilityResult = {
  available: false;
  reason: string;
};

export function lookupAvailability(): AvailabilityResult {
  return {
    available: false,
    reason:
      "Live availability is not available. No provider availability contract is configured.",
  };
}
