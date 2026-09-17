import { hotelbedsRequiresCheckRate } from "./hotelbeds-certification";

export function mergeHotelbedsNotices(...groups: Array<Array<string | null | undefined> | null | undefined>) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const value of group || []) {
      const text = value?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      merged.push(text);
    }
  }
  return merged;
}

export function assertHotelbedsPreflightAccepted(input: {
  preflighted?: boolean;
  termsAccepted?: boolean;
  rateType?: string | null;
  checkRateCompleted?: boolean;
}) {
  if (!input.preflighted) throw new Error("Hotelbeds checkout preflight is required before payment.");
  if (!input.termsAccepted) throw new Error("Accept the Hotelbeds rate terms before payment.");
  if (hotelbedsRequiresCheckRate(input.rateType) && !input.checkRateCompleted) {
    throw new Error("Hotelbeds RECHECK rate must complete CheckRate during preflight before payment.");
  }
}
