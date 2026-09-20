export const NON_APPOINTMENT_SUPPLIER_TYPES = new Set([
  "restaurant",
  "hotel",
  "event organizer",
]);

export function isAppointmentProviderBusinessType(
  businessType: string | null | undefined,
  hasServiceProfile: boolean,
) {
  const normalized = String(businessType || "").trim().toLowerCase();
  if (normalized) return !NON_APPOINTMENT_SUPPLIER_TYPES.has(normalized);
  return hasServiceProfile;
}
