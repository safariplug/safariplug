export type SupplierInvitationConfig = {
  businessType: string;
  category?: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const CONFIG: Record<string, SupplierInvitationConfig> = {
  "massage / wellness": { businessType: "Spa & Massage", category: "Spas & Massage" },
  "spas & massage": { businessType: "Spa & Massage", category: "Spas & Massage" },
  "barber / grooming": { businessType: "Barber", category: "Barbers" },
  "barbers": { businessType: "Barber", category: "Barbers" },
  "hair & beauty": { businessType: "Hair & Beauty", category: "Hair & Beauty" },
  "nails / beauty": { businessType: "Nails", category: "Nails" },
  "nails": { businessType: "Nails", category: "Nails" },
  "lashes & brows": { businessType: "Lashes & Brows", category: "Lashes & Brows" },
  "tattoo": { businessType: "Tattoo & Body Art", category: "Tattoo Artists & Body Art" },
  "tattoo artists & body art": { businessType: "Tattoo & Body Art", category: "Tattoo Artists & Body Art" },
  "fitness & personal training": { businessType: "Fitness", category: "Fitness & Personal Training" },
  "yoga/pilates/mindfulness": { businessType: "Yoga / Pilates / Mindfulness", category: "Yoga, Pilates & Mindfulness" },
  "yoga / pilates / mindfulness": { businessType: "Yoga / Pilates / Mindfulness", category: "Yoga, Pilates & Mindfulness" },
  "yoga, pilates & mindfulness": { businessType: "Yoga / Pilates / Mindfulness", category: "Yoga, Pilates & Mindfulness" },
  "diving / watersports": { businessType: "Diving & Marine", category: "Diving & Marine" },
  "diving & marine": { businessType: "Diving & Marine", category: "Diving & Marine" },
  "surfing & board sports": { businessType: "Surfing & Board Sports", category: "Surfing & Board Sports" },
  "kitesurfing / instructor": { businessType: "Water Sports & Kite", category: "Water Sports & Kite" },
  "water sports & kite": { businessType: "Water Sports & Kite", category: "Water Sports & Kite" },
  "photography & content": { businessType: "Other Service Business", category: "Photography & Content" },
  "private chefs & cooking": { businessType: "Other Service Business", category: "Private Chefs & Cooking" },
  "tour / experience": { businessType: "Tour Operator", category: "Tours & Local Guides" },
  "tours & local guides": { businessType: "Tour Operator", category: "Tours & Local Guides" },
  "tour operators": { businessType: "Tour Operator", category: "Tours & Local Guides" },
  "experiences": { businessType: "Experience Provider", category: "Tours & Local Guides" },
  "experience provider": { businessType: "Experience Provider", category: "Tours & Local Guides" },
  "restaurant / food": { businessType: "Restaurant" },
  "restaurants": { businessType: "Restaurant" },
  "hotel / stay": { businessType: "Hotel" },
  "hotels": { businessType: "Hotel" },
  "nightlife": { businessType: "Event Organizer" },
  "beach clubs": { businessType: "Event Organizer" },
};

export function resolveSupplierInvitationConfig(partnerType: string): SupplierInvitationConfig | null {
  return CONFIG[normalize(partnerType)] || null;
}

export function invitationEnrollmentKind(partnerType: string): "supplier" | "driver" | "local" | "unsupported" {
  if (resolveSupplierInvitationConfig(partnerType)) return "supplier";
  const normalized = normalize(partnerType);
  if (normalized.includes("driver") || normalized.includes("transfer")) return "driver";
  if (normalized.includes("local")) return "local";
  return "unsupported";
}

export function invitationDestination(partnerType: string) {
  const kind = invitationEnrollmentKind(partnerType);
  if (kind === "supplier") return "/supplier/onboarding";
  if (kind === "driver") return "/driver/signup";
  if (kind === "local") return "/locals/onboarding";
  return null;
}
