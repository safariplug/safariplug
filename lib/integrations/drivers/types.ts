export const DRIVER_PROVIDER_TYPES = [
  "independent_driver",
  "safariplug_driver",
  "transport_company",
  "hotel_driver",
  "tour_operator",
  "aurelian_driver",
  "external_driver_provider",
] as const;

export type DriverProviderType = (typeof DRIVER_PROVIDER_TYPES)[number];

export type DriverServiceStatus =
  | "pending"
  | "active"
  | "inactive"
  | "suspended"
  | "off_duty";

export type DriverVerificationState =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type VehicleStatus = "draft" | "active" | "inactive" | "retired";

export type DriverAvailabilityStatus =
  | "available"
  | "unavailable"
  | "off_duty"
  | "assigned";

export type DriverAssignmentStatus =
  | "assigned"
  | "reassigned"
  | "accepted"
  | "declined"
  | "cancelled"
  | "released"
  | "completed";

export const DRIVER_CAPABILITIES = [
  "airport_transfer",
  "hotel_transfer",
  "long_distance",
  "city_transfer",
  "child_seat",
  "wheelchair_accessible",
  "large_luggage",
  "premium_vehicle",
] as const;

export type DriverCapability = (typeof DRIVER_CAPABILITIES)[number];

export type DriverProviderStatus =
  | "unavailable"
  | "not_configured"
  | "configured"
  | "healthy"
  | "degraded"
  | "disabled";

export type DriverCapabilities = {
  listDrivers: boolean;
  getDriver: boolean;
  availability: boolean;
  assign: boolean;
  unassign: boolean;
};

export const NO_DRIVER_CAPABILITIES: DriverCapabilities = {
  listDrivers: false,
  getDriver: false,
  availability: false,
  assign: false,
  unassign: false,
};

export type DriverErrorCode =
  | "not_configured"
  | "unavailable"
  | "unauthorized"
  | "ineligible"
  | "not_found"
  | "conflict"
  | "contract_required"
  | "verification_required"
  | "bad_request";

export type DriverError = {
  code: DriverErrorCode;
  message: string;
};

export type DriverResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DriverError };

export type ServiceArea = {
  country?: string;
  region?: string;
  city_id?: string;
  city?: string;
  airport_code?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
};

export type DriverProfile = {
  id: string;
  provider_id: string | null;
  provider_type: DriverProviderType;
  display_name: string;
  contact_ref: string | null;
  service_status: DriverServiceStatus;
  verification_state: DriverVerificationState;
  preferred: boolean;
  capabilities: DriverCapability[];
  service_area: ServiceArea;
  source: string;
  external_id: string | null;
};

export type Vehicle = {
  id: string;
  provider_id: string | null;
  driver_id: string;
  category: string | null;
  make_model: string | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  accessibility: boolean;
  status: VehicleStatus;
};

export type DriverAvailabilitySlot = {
  id: string;
  driver_id: string;
  available_on: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  status: DriverAvailabilityStatus;
};

export type DriverAssignment = {
  id: string;
  booking_id: string;
  driver_id: string;
  vehicle_id: string | null;
  status: DriverAssignmentStatus;
  assigned_by: "admin" | "system" | "provider";
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicAssignedDriver = {
  assignment_id: string;
  display_name: string;
  vehicle_category: string | null;
  passenger_capacity: number | null;
  status: DriverAssignmentStatus;
};

export type TransferFulfillmentRequest = {
  booking_id: string;
  booking_status: string;
  pickup_date: string;
  pickup_time?: string;
  pickup_city?: string;
  pickup_airport?: string;
  dropoff_city?: string;
  adults: number;
  children: number;
  infants: number;
  luggage: number;
  required_capabilities?: DriverCapability[];
  preferred_driver_id?: string;
};

export type DriverActor =
  | { role: "admin" | "system" | "provider"; id?: string }
  | { role: "traveler"; id: string }
  | { role: "driver"; id: string };

export type DriverHealth = {
  provider: DriverProviderType;
  status: DriverProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  reachable: boolean;
  last_error: string | null;
  checked_at: string;
};

export type DriverProviderDescriptor = {
  key: DriverProviderType;
  name: string;
  status: DriverProviderStatus;
  configured: boolean;
  contract_implemented: boolean;
  capabilities: DriverCapabilities;
  reason: string;
  health: DriverHealth;
};

export type FutureLocationEvent = {
  driver_id: string;
  vehicle_id?: string;
  assignment_id?: string;
  booking_id?: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
};
