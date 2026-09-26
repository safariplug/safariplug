import { supabaseAdmin } from "@/lib/supabase-admin";
import { isAppointmentProviderBusinessType } from "@/lib/services/supplier-onboarding";
import { getVerificationAdapter } from "@/lib/integrations/verification";

export type SupplierReadinessKey =
  | "business_details"
  | "business_images"
  | "services_pricing"
  | "team"
  | "personal_photos"
  | "availability"
  | "staff_verification"
  | "verification"
  | "payout_details"
  | "restaurant_menu"
  | "restaurant_ordering";

export type SupplierReadinessIssue = {
  key: SupplierReadinessKey;
  label: string;
  href: string;
  owner: "supplier" | "platform";
};

export type SupplierActivationReadiness = {
  ready: boolean;
  appointmentProvider: boolean;
  completionPercent: number;
  issues: SupplierReadinessIssue[];
  checks: Record<string, boolean>;
};

function issue(
  key: SupplierReadinessKey,
  label: string,
  href: string,
  owner: "supplier" | "platform" = "supplier",
): SupplierReadinessIssue {
  return { key, label, href, owner };
}

function isFutureOrOpen(expiresAt?: string | null) {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export async function getSupplierOwnedBusiness(userId: string) {
  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,business_id,onboarding_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (supplierError) throw supplierError;

  if (supplier?.business_id) {
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id,name,verified,claimed,status,owner_id")
      .eq("id", supplier.business_id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (business) return { supplier, business };
  }

  const { data: business, error } = await supabaseAdmin
    .from("businesses")
    .select("id,name,verified,claimed,status,owner_id")
    .eq("owner_id", userId)
    .in("status", ["active", "ACTIVE"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { supplier: null, business };
}

export async function getSupplierActivationReadiness(supplierId: string): Promise<SupplierActivationReadiness> {
  const { data: supplier, error: supplierError } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id,user_id,business_id,completion_percent,onboarding_status")
    .eq("id", supplierId)
    .maybeSingle();
  if (supplierError) throw supplierError;
  if (!supplier) throw new Error("Supplier not found.");

  const [{ data: business, error: businessError }, { data: profiles, error: profilesError }, completion] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id,name,description,business_type,address,phone,whatsapp,email,logo_url,cover_image_url,supplier_gallery_urls")
      .eq("id", supplier.business_id)
      .maybeSingle(),
    supabaseAdmin
      .from("service_profiles")
      .select("id,status,booking_status,service_offerings(id,name,price,duration_minutes,status),service_staff(id,user_id,display_name,status,personal_photo_url,verification_state,identity_liveness_verified_at)")
      .eq("business_id", supplier.business_id),
    supabaseAdmin.rpc("supplier_completion", { p_business_id: supplier.business_id }),
  ]);
  if (businessError) throw businessError;
  if (profilesError) throw profilesError;
  if (completion.error) throw completion.error;
  if (!business) throw new Error("Supplier business not found.");

  const appointmentProvider = isAppointmentProviderBusinessType(
    business.business_type,
    Boolean((profiles ?? []).length),
  );
  const profileRows = profiles ?? [];
  const offerings = profileRows.flatMap((profile: any) => {
    const raw = profile.service_offerings;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  });
  const staff = profileRows.flatMap((profile: any) => {
    const raw = profile.service_staff;
    return Array.isArray(raw) ? raw : raw ? [raw] : [];
  }).filter((member: any) => member.status === "active");
  const staffIds = staff.map((member: any) => String(member.id));

  const isRestaurant = business.business_type === "Restaurant";

  const [
    { data: availability },
    { data: providerVerification },
    { data: payout },
    { data: staffCases },
    { data: restaurantSettings },
    { data: restaurantMenuItems },
  ] = await Promise.all([
    staffIds.length
      ? supabaseAdmin.from("service_staff_availability").select("staff_id,is_active").in("staff_id", staffIds).eq("is_active", true)
      : Promise.resolve({ data: [] as { staff_id: string; is_active: boolean }[] }),
    supplier.user_id
      ? supabaseAdmin
          .from("verification_cases")
          .select("status,expires_at,provider")
          .eq("subject_type", "provider")
          .eq("subject_id", supplier.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supplier.user_id
      ? supabaseAdmin
          .from("service_provider_payout_accounts")
          .select("status,verified_at")
          .eq("provider_user_id", supplier.user_id)
          .eq("provider", "mpesa_b2c")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    staffIds.length
      ? supabaseAdmin
          .from("verification_cases")
          .select("subject_id,status,expires_at,provider,created_at")
          .eq("subject_type", "service_staff")
          .in("subject_id", staffIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { subject_id: string; status: string; expires_at: string | null }[] }),
    isRestaurant
      ? supabaseAdmin
          .from("restaurant_settings")
          .select("ordering_enabled,pickup_enabled,safari_driver_enabled,customer_driver_enabled,restaurant_delivery_enabled")
          .eq("business_id", supplier.business_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isRestaurant
      ? supabaseAdmin
          .from("restaurant_menu_items")
          .select("id,active,available")
          .eq("business_id", supplier.business_id)
      : Promise.resolve({ data: [] as { id: string; active: boolean; available: boolean }[] }),
  ]);

  const completionPercent = Number(completion.data ?? supplier.completion_percent ?? 0);
  const hasContact = Boolean(business.phone || business.email || business.whatsapp);
  const missingBusinessBasics = [
    !business.name ? "business name" : null,
    !business.description ? "business description" : null,
    !business.address ? "business address" : null,
    !hasContact ? "phone, email, or WhatsApp" : null,
  ].filter((value): value is string => Boolean(value));
  const businessDetailsReady = missingBusinessBasics.length === 0;
  const businessImagesReady = Boolean(
    business.logo_url ||
    business.cover_image_url ||
    (Array.isArray(business.supplier_gallery_urls) && business.supplier_gallery_urls.length)
  );

  const validOfferings = offerings.length > 0 && offerings.every((offering: any) =>
    Number(offering.price || 0) > 0 && Number(offering.duration_minutes || 0) > 0
  );
  const teamReady = staff.length > 0;
  const personalPhotosReady = teamReady && staff.every((member: any) => Boolean(member.personal_photo_url));
  const availabilityByStaff = new Set((availability ?? []).map((row: any) => String(row.staff_id)));
  const availabilityReady = teamReady && staff.every((member: any) => availabilityByStaff.has(String(member.id)));

  const latestStaffCases = new Map<string, any>();
  for (const row of staffCases ?? []) {
    const key = String((row as any).subject_id);
    if (!latestStaffCases.has(key)) latestStaffCases.set(key, row);
  }
  const staffVerificationReady = teamReady && staff.every((member: any) => {
    const current = latestStaffCases.get(String(member.id));
    if (!current || current.status !== "approved" || !isFutureOrOpen(current.expires_at)) return false;
    if (!member.user_id || member.verification_state !== "verified") return false;
    if (current.provider === "human_review") return true;
    return Boolean(member.identity_liveness_verified_at);
  });
  const staffVerificationWaitingOnPlatform = teamReady && staff.every((member: any) => {
    if (staffVerificationReady) return true;
    const current = latestStaffCases.get(String(member.id));
    return Boolean(
      current &&
      current.provider === "human_review" &&
      ["pending", "in_review"].includes(String(current.status))
    );
  });

  const providerVerificationReady = Boolean(
    providerVerification?.status === "approved" && isFutureOrOpen(providerVerification.expires_at)
  );
  const identityAdapter = getVerificationAdapter("identity_provider");
  const livenessAdapter = getVerificationAdapter("liveness_provider");
  const verificationSystemReady = [identityAdapter, livenessAdapter].every((adapter) =>
    adapter.contractImplemented() && adapter.credentialsPresent()
  );
  const payoutReady = Boolean(payout?.status === "verified" && payout?.verified_at);
  const providerVerificationWaitingOnPlatform = Boolean(
    providerVerification &&
    providerVerification.provider === "human_review" &&
    ["pending", "in_review"].includes(String(providerVerification.status))
  );
  const payoutWaitingOnPlatform = Boolean(payout?.status === "pending");
  const restaurantMenuReady = !isRestaurant || Boolean(
    (restaurantMenuItems ?? []).some((item: any) => item.active === true && item.available === true)
  );
  const restaurantOrderingReady = !isRestaurant || Boolean(
    restaurantSettings?.ordering_enabled &&
    (
      restaurantSettings.pickup_enabled ||
      restaurantSettings.safari_driver_enabled ||
      restaurantSettings.customer_driver_enabled ||
      restaurantSettings.restaurant_delivery_enabled
    )
  );

  const issues: SupplierReadinessIssue[] = [];
  if (!businessDetailsReady || completionPercent < 80) {
    const missingLabel = missingBusinessBasics.length
      ? `Add ${missingBusinessBasics.join(missingBusinessBasics.length === 2 ? " and " : ", ")}`
      : "Reach at least 80% profile completion";
    issues.push(issue("business_details", missingLabel, "/supplier/onboarding#business-details"));
  }
  if (!businessImagesReady) {
    issues.push(issue("business_images", "Add a business logo, cover image, or gallery image", "/supplier/onboarding#business-images"));
  }

  if (isRestaurant) {
    if (!restaurantMenuReady) {
      issues.push(issue(
        "restaurant_menu",
        "Add at least one active, available menu item",
        "/business/restaurants/menu",
      ));
    }
    if (!restaurantOrderingReady) {
      issues.push(issue(
        "restaurant_ordering",
        "Enable restaurant ordering and at least one pickup or delivery method",
        "/business/restaurants/menu",
      ));
    }
  }

  if (appointmentProvider) {
    if (!validOfferings) issues.push(issue("services_pricing", "Add valid service pricing and duration for every service", "/supplier/onboarding#services-pricing"));
    if (!teamReady) issues.push(issue("team", "Add at least one active service specialist", "/supplier/onboarding#team-availability"));
    if (teamReady && !personalPhotosReady) issues.push(issue("personal_photos", "Add a personal photo for every active specialist", "/business/services/identity"));
    if (teamReady && !availabilityReady) issues.push(issue("availability", "Add active availability for every active specialist", "/supplier/onboarding#team-availability"));
    if (teamReady && !staffVerificationReady) issues.push(issue(
      "staff_verification",
      verificationSystemReady
        ? "Complete specialist identity + live face verification"
        : staffVerificationWaitingOnPlatform
          ? "SafariPlug staff review is waiting for every active specialist"
          : "Request SafariPlug staff review for every active specialist",
      "/business/services/identity",
      staffVerificationWaitingOnPlatform ? "platform" : "supplier",
    ));
    if (!providerVerificationReady) issues.push(issue(
      "verification",
      verificationSystemReady
        ? "Complete provider identity + liveness verification"
        : providerVerificationWaitingOnPlatform
          ? "SafariPlug staff review is waiting for the provider account"
          : "Request SafariPlug staff review for the provider account",
      "/business/verification",
      providerVerificationWaitingOnPlatform ? "platform" : "supplier",
    ));
    if (!payoutReady) issues.push(issue(
      "payout_details",
      payoutWaitingOnPlatform
        ? "SafariPlug finance must verify the M-Pesa payout destination"
        : "Configure the M-Pesa payout destination",
      "/business/payouts",
      payoutWaitingOnPlatform ? "platform" : "supplier",
    ));
  }

  return {
    ready: issues.length === 0,
    appointmentProvider,
    completionPercent,
    issues,
    checks: {
      businessDetails: businessDetailsReady && completionPercent >= 80,
      businessImages: businessImagesReady,
      servicesPricing: !appointmentProvider || validOfferings,
      team: !appointmentProvider || teamReady,
      personalPhotos: !appointmentProvider || personalPhotosReady,
      availability: !appointmentProvider || availabilityReady,
      staffVerification: !appointmentProvider || staffVerificationReady,
      verificationSystem: !appointmentProvider || verificationSystemReady || providerVerification?.provider === "human_review",
      providerVerification: !appointmentProvider || providerVerificationReady,
      payout: !appointmentProvider || payoutReady,
      restaurantMenu: restaurantMenuReady,
      restaurantOrdering: restaurantOrderingReady,
    },
  };
}
