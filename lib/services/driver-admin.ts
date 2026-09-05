import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  DriverAvailabilitySlot,
  DriverCapability,
  DriverProfile,
  DriverProviderType,
  DriverServiceStatus,
  DriverVerificationState,
  Vehicle,
  VehicleStatus,
} from "@/lib/integrations/drivers/types";

export type DriverAdminInput = {
  display_name: string;
  provider_type?: DriverProviderType;
  contact_ref?: string | null;
  service_status?: DriverServiceStatus;
  preferred?: boolean;
  capabilities?: DriverCapability[];
  service_country?: string | null;
  service_region?: string | null;
  service_city_id?: string | null;
  service_city?: string | null;
  service_airport_code?: string | null;
  service_lat?: number | null;
  service_lng?: number | null;
  service_radius_km?: number | null;
  provider_id?: string | null;
  external_id?: string | null;
};

export type VehicleAdminInput = {
  driver_id: string;
  provider_id?: string | null;
  category?: string | null;
  make_model?: string | null;
  passenger_capacity?: number | null;
  luggage_capacity?: number | null;
  accessibility?: boolean;
  status?: VehicleStatus;
};

export type AvailabilityAdminInput = {
  driver_id: string;
  available_on: string;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string;
  status?: DriverAvailabilitySlot["status"];
};

function driverFromRow(row: Record<string, unknown>): DriverProfile {
  return {
    id: String(row.id),
    provider_id: (row.provider_id as string | null) ?? null,
    provider_type: row.provider_type as DriverProviderType,
    display_name: String(row.display_name ?? ""),
    contact_ref: (row.contact_ref as string | null) ?? null,
    service_status: row.service_status as DriverServiceStatus,
    verification_state: row.verification_state as DriverVerificationState,
    preferred: Boolean(row.preferred),
    capabilities: (row.capabilities as DriverCapability[] | null) ?? [],
    service_area: {
      country: (row.service_country as string | null) ?? undefined,
      region: (row.service_region as string | null) ?? undefined,
      city_id: (row.service_city_id as string | null) ?? undefined,
      city: (row.service_city as string | null) ?? undefined,
      airport_code: (row.service_airport_code as string | null) ?? undefined,
      latitude: row.service_lat == null ? undefined : Number(row.service_lat),
      longitude: row.service_lng == null ? undefined : Number(row.service_lng),
      radius_km: row.service_radius_km == null ? undefined : Number(row.service_radius_km),
    },
    source: String(row.source ?? "safariplug"),
    external_id: (row.external_id as string | null) ?? null,
  };
}

function vehicleFromRow(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    provider_id: (row.provider_id as string | null) ?? null,
    driver_id: String(row.driver_id),
    category: (row.category as string | null) ?? null,
    make_model: (row.make_model as string | null) ?? null,
    passenger_capacity: row.passenger_capacity == null ? null : Number(row.passenger_capacity),
    luggage_capacity: row.luggage_capacity == null ? null : Number(row.luggage_capacity),
    accessibility: Boolean(row.accessibility),
    status: row.status as VehicleStatus,
  };
}

function availabilityFromRow(row: Record<string, unknown>): DriverAvailabilitySlot {
  return {
    id: String(row.id),
    driver_id: String(row.driver_id),
    available_on: String(row.available_on),
    start_time: (row.start_time as string | null) ?? null,
    end_time: (row.end_time as string | null) ?? null,
    timezone: String(row.timezone ?? "Africa/Nairobi"),
    status: row.status as DriverAvailabilitySlot["status"],
  };
}

export async function listDriversAdmin(): Promise<DriverProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list drivers: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(driverFromRow);
}

export async function listVehiclesAdmin(driverId?: string): Promise<Vehicle[]> {
  let query = supabaseAdmin.from("vehicles").select("*").order("created_at", { ascending: false });
  if (driverId) query = query.eq("driver_id", driverId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list vehicles: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(vehicleFromRow);
}

export async function listAvailabilityAdmin(driverId?: string): Promise<DriverAvailabilitySlot[]> {
  let query = supabaseAdmin
    .from("driver_availability")
    .select("*")
    .order("available_on", { ascending: true })
    .order("start_time", { ascending: true });
  if (driverId) query = query.eq("driver_id", driverId);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list driver availability: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(availabilityFromRow);
}

export async function createDriverAdmin(input: DriverAdminInput): Promise<DriverProfile> {
  const name = input.display_name.trim();
  if (!name) throw new Error("Driver display name is required.");
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .insert({
      display_name: name,
      provider_type: input.provider_type ?? "independent_driver",
      contact_ref: input.contact_ref ?? null,
      service_status: "pending",
      verification_state: "unverified",
      preferred: input.preferred ?? false,
      capabilities: input.capabilities ?? [],
      service_country: input.service_country ?? null,
      service_region: input.service_region ?? null,
      service_city_id: input.service_city_id ?? null,
      service_city: input.service_city ?? null,
      service_airport_code: input.service_airport_code ?? null,
      service_lat: input.service_lat ?? null,
      service_lng: input.service_lng ?? null,
      service_radius_km: input.service_radius_km ?? null,
      provider_id: input.provider_id ?? null,
      external_id: input.external_id ?? null,
      source: "safariplug",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create driver: ${error.message}`);
  return driverFromRow(data as Record<string, unknown>);
}

export async function updateDriverAdmin(id: string, patch: Partial<DriverAdminInput>): Promise<DriverProfile> {
  const updates: Record<string, unknown> = {};
  for (const key of [
    "display_name", "provider_type", "contact_ref", "preferred", "capabilities",
    "service_country", "service_region", "service_city_id", "service_city",
    "service_airport_code", "service_lat", "service_lng", "service_radius_km",
    "provider_id", "external_id",
  ] as const) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  if (patch.service_status !== undefined) updates.service_status = patch.service_status;
  if (Object.keys(updates).length === 0) throw new Error("No driver fields supplied.");
  const { data, error } = await supabaseAdmin.from("driver_profiles").update(updates).eq("id", id).select("*").single();
  if (error) throw new Error(`Failed to update driver: ${error.message}`);
  return driverFromRow(data as Record<string, unknown>);
}

export async function createVehicleAdmin(input: VehicleAdminInput): Promise<Vehicle> {
  if (!input.driver_id) throw new Error("driver_id is required.");
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .insert({
      driver_id: input.driver_id,
      provider_id: input.provider_id ?? null,
      category: input.category ?? null,
      make_model: input.make_model ?? null,
      passenger_capacity: input.passenger_capacity ?? null,
      luggage_capacity: input.luggage_capacity ?? null,
      accessibility: input.accessibility ?? false,
      status: input.status ?? "draft",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create vehicle: ${error.message}`);
  return vehicleFromRow(data as Record<string, unknown>);
}

export async function updateVehicleAdmin(id: string, patch: Partial<VehicleAdminInput>): Promise<Vehicle> {
  const updates = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  delete updates.driver_id;
  if (Object.keys(updates).length === 0) throw new Error("No vehicle fields supplied.");
  const { data, error } = await supabaseAdmin.from("vehicles").update(updates).eq("id", id).select("*").single();
  if (error) throw new Error(`Failed to update vehicle: ${error.message}`);
  return vehicleFromRow(data as Record<string, unknown>);
}

export async function createAvailabilityAdmin(input: AvailabilityAdminInput): Promise<DriverAvailabilitySlot> {
  if (!input.driver_id || !input.available_on) throw new Error("driver_id and available_on are required.");
  const { data, error } = await supabaseAdmin
    .from("driver_availability")
    .insert({
      driver_id: input.driver_id,
      available_on: input.available_on,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      timezone: input.timezone ?? "Africa/Nairobi",
      status: input.status ?? "available",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create availability: ${error.message}`);
  return availabilityFromRow(data as Record<string, unknown>);
}

export async function updateAvailabilityAdmin(id: string, patch: Partial<AvailabilityAdminInput>): Promise<DriverAvailabilitySlot> {
  const updates = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  delete updates.driver_id;
  if (Object.keys(updates).length === 0) throw new Error("No availability fields supplied.");
  const { data, error } = await supabaseAdmin.from("driver_availability").update(updates).eq("id", id).select("*").single();
  if (error) throw new Error(`Failed to update availability: ${error.message}`);
  return availabilityFromRow(data as Record<string, unknown>);
}
