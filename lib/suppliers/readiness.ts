import { supabaseAdmin } from "@/lib/supabase-admin";

export type SupplierReadinessKey =
  | "business_details"
  | "business_images"
  | "services_pricing"
  | "team"
  | "personal_photos"
  | "availability"
  | "staff_verification"
  | "verification"
  | "payout_details";

export type SupplierReadinessIssue = {
  key: SupplierReadinessKey;
  label: string;
  href: string;
};

export type SupplierActivationReadiness = {
  ready: boolean;
  appointmentProvider: boolean;
  completionPercent: number;
  issues: SupplierReadinessIssue[];
  checks: Record<string, boolean>;
};

function issue(key: SupplierReadinessKey, label: string, href: string): SupplierReadinessIssue {
  return { key, label, href };
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
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

  const businessType = String(business.business_type || "");
  const appointmentProvider = Boolean((profiles ?? []).length) && !["Restaurant", "Hotel", "Event Organizer"].includes(businessType);
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

  const [{ data: availability }, { data: providerVerification }, { data: payout }, { data: staffCases }] = await Promise.all([
    staffIds.length
      ? supabaseAdmin.from("service_staff_availability").select("staff_id,is_active").in("staff_id", staffIds).eq("is_active", true)
      : Promise.resolve({ data: [] as { staff_id: string; is_active: boolean }[] }),
    supplier.user_id
      ? supabaseAdmin
          .from("verification_cases")
          .select("status,expires_at")
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
          .select("subject_id,status,expires_at")
          .eq("subject_type", "service_staff")
          .in("subject_id", staffIds)
          .eq("status", "approved")
      : Promise.resolve({ data: [] as { subject_id: string; status: string; expires_at: string | null }[] }),
  ]);

  const completionPercent = Number(completion.data ?? supplier.completion_percent ?? 0);
  const hasContact = Boolean(business.phone || business.email || business.whatsapp);
  const businessDetailsReady = Boolean(business.name && business.description && business.address && hasContact);
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

  const approvedStaffCases = new Map(
    (staffCases ?? [])
      .filter((row: any) => isFutureOrOpen(row.expires_at))
      .map((row: any) => [String(row.subject_id), true])
  );
  const staffVerificationReady = teamReady && staff.every((member: any) =>
    Boolean(member.user_id) &&
    member.verification_state === "verified" &&
    Boolean(member.identity_liveness_verified_at) &&
    approvedStaffCases.has(String(member.id))
  );

  const providerVerificationReady = Boolean(
    providerVerification?.status === "approved" && isFutureOrOpen(providerVerification.expires_at)
  );
  const payoutReady = Boolean(payout?.status === "verified" && payout?.verified_at);

  const issues: SupplierReadinessIssue[] = [];
  if (!businessDetailsReady || completionPercent < 80) {
    issues.push(issue("business_details", "Complete required business details and reach at least 80% profile completion", "/supplier/onboarding#business-details"));
  }
  if (!businessImagesReady) {
    issues.push(issue("business_images", "Add a business logo, cover image, or gallery image", "/supplier/onboarding#business-images"));
  }

  if (appointmentProvider) {
    if (!validOfferings) issues.push(issue("services_pricing", "Add valid service pricing and duration for every service", "/supplier/onboarding#services-pricing"));
    if (!teamReady) issues.push(issue("team", "Add at least one active service specialist", "/supplier/onboarding#team-availability"));
    if (teamReady && !personalPhotosReady) issues.push(issue("personal_photos", "Add a personal photo for every active specialist", "/business/services/identity"));
    if (teamReady && !availabilityReady) issues.push(issue("availability", "Add active availability for every active specialist", "/supplier/onboarding#team-availability"));
    if (teamReady && !staffVerificationReady) issues.push(issue("staff_verification", "Complete identity + live face verification for every active specialist", "/business/services/identity"));
    if (!providerVerificationReady) issues.push(issue("verification", "Complete provider identity + liveness verification", "/business/verification"));
    if (!payoutReady) issues.push(issue("payout_details", "Configure and verify the M-Pesa payout destination", "/business/payouts"));
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
      providerVerification: !appointmentProvider || providerVerificationReady,
      payout: !appointmentProvider || payoutReady,
    },
  };
}
