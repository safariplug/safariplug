export const GOOGLE_TTD_CATEGORIES = new Set([
  "Experiences",
  "Tours & Local Guides",
  "Diving & Marine",
  "Surfing & Board Sports",
  "Water Sports & Kite",
]);

export type GoogleTtdCandidate = {
  profileId: string;
  offeringId: string;
  category: string;
  businessName: string;
  businessSlug: string | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  offeringName: string;
  offeringDescription: string | null;
  durationMinutes: number | null;
  price: number | null;
  currency: string | null;
  businessStatus: string | null;
  profileStatus: string | null;
  bookingStatus: string | null;
  offeringStatus: string | null;
};

export type GoogleTtdReadiness = {
  id: string;
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  product: {
    id: string;
    title: string;
    description: string | null;
    operator: {
      name: string;
      googleBusinessProfileName: string;
      phoneNumber: string | null;
    };
    location: {
      coordinates: { latitude: number; longitude: number } | null;
      description: string | null;
    };
    option: {
      id: string;
      title: string;
      landingPageUrl: string | null;
      price: { currencyCode: string; units: number } | null;
      durationSec: number | null;
    };
  };
};

function validLatLng(latitude: number | null, longitude: number | null) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number(longitude) >= -180 && Number(longitude) <= 180;
}

export function googleTtdReadiness(candidate: GoogleTtdCandidate): GoogleTtdReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const activeBusiness = ["active","ACTIVE"].includes(String(candidate.businessStatus || ""));
  const liveProfile = candidate.profileStatus === "active" && candidate.bookingStatus === "open";
  const liveOffering = candidate.offeringStatus === "active";
  const landingPageUrl = candidate.businessSlug
    ? `https://www.safariplug.com/services/${encodeURIComponent(candidate.businessSlug)}`
    : null;
  const hasLocation = validLatLng(candidate.latitude, candidate.longitude) || Boolean(candidate.address?.trim());
  const hasPrice = Number.isFinite(candidate.price) && Number(candidate.price) > 0 && Boolean(candidate.currency?.trim());

  if (!GOOGLE_TTD_CATEGORIES.has(candidate.category)) blockers.push("Category is not in SafariPlug's current Things to do allowlist.");
  if (!activeBusiness) blockers.push("Business is not active.");
  if (!liveProfile) blockers.push("Service profile is not active and open for booking.");
  if (!liveOffering) blockers.push("Offering is not active.");
  if (!candidate.businessName.trim()) blockers.push("Operator name is missing.");
  if (!candidate.offeringName.trim()) blockers.push("Option title is missing.");
  if (!candidate.description?.trim() && !candidate.offeringDescription?.trim()) blockers.push("Product description is missing.");
  if (!landingPageUrl) blockers.push("SafariPlug landing page URL is missing.");
  if (!hasLocation) blockers.push("A physical location or address is required.");
  if (!hasPrice) blockers.push("A positive final price and currency are required.");
  if (!candidate.durationMinutes || candidate.durationMinutes <= 0) warnings.push("Duration is missing; guided-tour style products should provide duration when applicable.");
  if (!candidate.phone?.trim()) warnings.push("Operator phone number is not recorded.");
  warnings.push("Confirm the operator name exactly matches the Google Business Profile before feed submission.");
  warnings.push("This is SafariPlug preflight data, not a certified Google Actions Center feed.");

  return {
    id: `${candidate.profileId}:${candidate.offeringId}`,
    eligible: blockers.length === 0,
    blockers,
    warnings,
    product: {
      id: `sp-${candidate.profileId}-${candidate.offeringId}`,
      title: candidate.offeringName,
      description: candidate.offeringDescription?.trim() || candidate.description?.trim() || null,
      operator: {
        name: candidate.businessName,
        googleBusinessProfileName: candidate.businessName,
        phoneNumber: candidate.phone?.trim() || null,
      },
      location: {
        coordinates: validLatLng(candidate.latitude, candidate.longitude)
          ? { latitude: Number(candidate.latitude), longitude: Number(candidate.longitude) }
          : null,
        description: candidate.address?.trim() || null,
      },
      option: {
        id: `option-${candidate.offeringId}`,
        title: candidate.offeringName,
        landingPageUrl,
        price: hasPrice ? { currencyCode: String(candidate.currency).toUpperCase(), units: Number(candidate.price) } : null,
        durationSec: candidate.durationMinutes && candidate.durationMinutes > 0 ? Math.round(candidate.durationMinutes * 60) : null,
      },
    },
  };
}
