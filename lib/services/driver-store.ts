import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  DriverAssignment,
  DriverAvailabilitySlot,
  DriverProfile,
  DriverProviderType,
  DriverServiceStatus,
  Vehicle,
  VehicleStatus,
} from "@/lib/integrations/drivers/types";

function toProfile(row: any): DriverProfile {
  return {
    id: row.id,
    provider_id: row.provider_id ?? null,
    provider_type: row.provider_type as DriverProviderType,
    display_name: row.display_name,
    contact_ref: row.contact_ref ?? null,
    service_status: row.service_status as DriverServiceStatus,
    verification_state: row.verification_state,
    preferred: Boolean(row.preferred),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    service_area: {
      country: row.service_country ?? undefined,
      region: row.service_region ?? undefined,
      city_id: row.service_city_id ?? undefined,
      city: row.service_city ?? undefined,
      airport_code: row.service_airport_code ?? undefined,
      latitude: row.service_lat == null ? undefined : Number(row.service_lat),
      longitude: row.service_lng == null ? undefined : Number(row.service_lng),
      radius_km: row.service_radius_km == null ? undefined : Number(row.service_radius_km),
    },
    source: row.source,
    external_id: row.external_id ?? null,
  };
}

function toVehicle(row: any): Vehicle {
  return {
    id: row.id,
    provider_id: row.provider_id ?? null,
    driver_id: row.driver_id,
    category: row.category ?? null,
    make_model: row.make_model ?? null,
    passenger_capacity: row.passenger_capacity ?? null,
    luggage_capacity: row.luggage_capacity ?? null,
    accessibility: Boolean(row.accessibility),
    status: row.status as VehicleStatus,
  };
}

function toAvailability(row: any): DriverAvailabilitySlot {
  return {
    id: row.id,
    driver_id: row.driver_id,
    available_on: row.available_on,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    timezone: row.timezone,
    status: row.status,
  };
}

function toAssignment(row: any): DriverAssignment {
  return {
    id: row.id,
    booking_id: row.booking_id,
    driver_id: row.driver_id,
    vehicle_id: row.vehicle_id ?? null,
    status: row.status,
    assigned_by: row.assigned_by,
    note: row.note ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPersistedDrivers(): Promise<DriverProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load drivers: ${error.message}`);
  return (data ?? []).map(toProfile);
}

export async function listPersistedVehicles(driverId?: string): Promise<Vehicle[]> {
  let query = supabaseAdmin.from("vehicles").select("*").order("created_at", { ascending: false });
  if (driverId) query = query.eq("driver_id", driverId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load vehicles: ${error.message}`);
  return (data ?? []).map(toVehicle);
}

export async function listPersistedAvailability(driverId: string, date?: string): Promise<DriverAvailabilitySlot[]> {
  let query = supabaseAdmin.from("driver_availability").select("*").eq("driver_id", driverId).order("available_on");
  if (date) query = query.eq("available_on", date);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load availability: ${error.message}`);
  return (data ?? []).map(toAvailability);
}

export async function listPersistedAssignments(bookingId?: string): Promise<DriverAssignment[]> {
  let query = supabaseAdmin.from("driver_assignments").select("*").order("created_at", { ascending: false });
  if (bookingId) query = query.eq("booking_id", bookingId);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load assignments: ${error.message}`);
  return (data ?? []).map(toAssignment);
}

export async function createDriver(input: {
  display_name: string;
  provider_type?: DriverProviderType;
  provider_id?: string | null;
  contact_ref?: string | null;
  preferred?: boolean;
  capabilities?: string[];
  service_country?: string | null;
  service_region?: string | null;
  service_city_id?: string | null;
  service_city?: string | null;
  service_airport_code?: string | null;
  service_lat?: number | null;
  service_lng?: number | null;
  service_radius_km?: number | null;
  external_id?: string | null;
}) {
  if (!input.display_name.trim()) throw new Error("Driver name is required.");
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .insert({
      display_name: input.display_name.trim(),
      provider_type: input.provider_type ?? "independent_driver",
      provider_id: input.provider_id ?? null,
      contact_ref: input.contact_ref ?? null,
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
      external_id: input.external_id ?? null,
      source: "safariplug",
    })
    .select("*")
    .single();
  if (error) throw new Error(`Unable to create driver: ${error.message}`);
  return toProfile(data);
}

export async function updateDriverStatus(driverId: string, serviceStatus: DriverServiceStatus) {
  const { data, error } = await supabaseAdmin
    .from("driver_profiles")
    .update({ service_status: serviceStatus, updated_at: new Date().toISOString() })
    .eq("id", driverId)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update driver: ${error.message}`);
  return toProfile(data);
}

export async function createVehicle(input: {
  driver_id: string;
  provider_id?: string | null;
  category?: string | null;
  make_model?: string | null;
  passenger_capacity?: number | null;
  luggage_capacity?: number | null;
  accessibility?: boolean;
  status?: VehicleStatus;
}) {
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
  if (error) throw new Error(`Unable to create vehicle: ${error.message}`);
  return toVehicle(data);
}

export async function updateVehicleStatus(vehicleId: string, status: VehicleStatus) {
  const { data, error } = await supabaseAdmin
    .from("vehicles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update vehicle: ${error.message}`);
  return toVehicle(data);
}

export async function createAvailability(input: {
  driver_id: string;
  available_on: string;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string;
  status?: string;
}) {
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
  if (error) throw new Error(`Unable to create availability: ${error.message}`);
  return toAvailability(data);
}

export async function persistAssignment(input: {
  booking_id: string;
  driver_id: string;
  vehicle_id?: string | null;
  assigned_by: "admin" | "system" | "provider";
  note?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("driver_assignments")
    .insert({
      booking_id: input.booking_id,
      driver_id: input.driver_id,
      vehicle_id: input.vehicle_id ?? null,
      assigned_by: input.assigned_by,
      status: "assigned",
      note: input.note ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Unable to persist driver assignment: ${error.message}`);
  return toAssignment(data);
}

export async function updatePersistedAssignment(id: string, patch: { status: string; note?: string | null }) {
  const { data, error } = await supabaseAdmin
    .from("driver_assignments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update driver assignment: ${error.message}`);
  return toAssignment(data);
}
