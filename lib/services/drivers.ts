import { liveDriverAdapters } from "@/lib/integrations/drivers/registry";
import type {
  DriverActor,
  DriverAssignment,
  DriverAvailabilitySlot,
  DriverError,
  DriverProfile,
  DriverResult,
  PublicAssignedDriver,
  TransferFulfillmentRequest,
  Vehicle,
} from "@/lib/integrations/drivers/types";
import {
  getDriverTrustStatus,
  type VerificationStore,
} from "./verification";

export const ASSIGNABLE_BOOKING_STATUSES = ["confirmed", "booked"] as const;

export type DriverStore = {
  listDrivers(): DriverProfile[];
  getDriver(id: string): DriverProfile | undefined;
  listVehicles(driverId?: string): Vehicle[];
  listAvailability(driverId: string, onDate: string): DriverAvailabilitySlot[];
  listAssignments(bookingId?: string): DriverAssignment[];
  saveAssignment(row: DriverAssignment): void;
  updateAssignment(
    id: string,
    patch: Partial<DriverAssignment>
  ): DriverAssignment | undefined;
};

export class MemoryDriverStore implements DriverStore {
  constructor(
    private drivers: DriverProfile[] = [],
    private vehicles: Vehicle[] = [],
    private slots: DriverAvailabilitySlot[] = [],
    private assignments: DriverAssignment[] = []
  ) {}

  listDrivers() {
    return [...this.drivers];
  }
  getDriver(id: string) {
    return this.drivers.find((row) => row.id === id);
  }
  listVehicles(driverId?: string) {
    return this.vehicles.filter((row) => !driverId || row.driver_id === driverId);
  }
  listAvailability(driverId: string, onDate: string) {
    return this.slots.filter(
      (row) => row.driver_id === driverId && row.available_on === onDate
    );
  }
  listAssignments(bookingId?: string) {
    return this.assignments.filter(
      (row) => !bookingId || row.booking_id === bookingId
    );
  }
  saveAssignment(row: DriverAssignment) {
    this.assignments.push(row);
  }
  updateAssignment(id: string, patch: Partial<DriverAssignment>) {
    const row = this.assignments.find((item) => item.id === id);
    if (!row) return undefined;
    Object.assign(row, patch, { updated_at: now() });
    return row;
  }
}

const productionStore = new MemoryDriverStore();

function now() {
  return new Date().toISOString();
}

function fail(code: DriverError["code"], message: string): DriverResult<never> {
  return { ok: false, error: { code, message } };
}

export function canActorAssign(actor: DriverActor): boolean {
  return actor.role === "admin" || actor.role === "system" || actor.role === "provider";
}

export function toPublicAssignedDriver(
  assignment: DriverAssignment,
  driver: DriverProfile,
  vehicle: Vehicle | undefined
): PublicAssignedDriver {
  return {
    assignment_id: assignment.id,
    display_name: driver.display_name,
    vehicle_category: vehicle?.category ?? null,
    passenger_capacity: vehicle?.passenger_capacity ?? null,
    status: assignment.status,
  };
}

export function bookingAllowsAssignment(status: string): boolean {
  return (ASSIGNABLE_BOOKING_STATUSES as readonly string[]).includes(status);
}

function areaMatches(driver: DriverProfile, request: TransferFulfillmentRequest) {
  const area = driver.service_area;
  if (request.pickup_airport && area.airport_code) {
    return area.airport_code.toUpperCase() === request.pickup_airport.toUpperCase();
  }
  if (request.pickup_city && area.city) {
    return area.city.toLowerCase() === request.pickup_city.toLowerCase();
  }
  if (request.pickup_city && area.city_id) {
    return area.city_id === request.pickup_city;
  }
  if (!area.city && !area.city_id && !area.airport_code && !area.country) {
    return false;
  }
  if (request.pickup_city || request.pickup_airport) return false;
  return true;
}

function capabilityMatches(driver: DriverProfile, request: TransferFulfillmentRequest) {
  const required = request.required_capabilities ?? [];
  return required.every((cap) => driver.capabilities.includes(cap));
}

function activeVehicle(store: DriverStore, driverId: string) {
  return store
    .listVehicles(driverId)
    .find((vehicle) => vehicle.status === "active");
}

function capacityMatches(vehicle: Vehicle | undefined, request: TransferFulfillmentRequest) {
  if (!vehicle) return false;
  const passengers = request.adults + request.children;
  if (
    vehicle.passenger_capacity != null &&
    vehicle.passenger_capacity < passengers
  ) {
    return false;
  }
  if (vehicle.luggage_capacity != null && vehicle.luggage_capacity < request.luggage) {
    return false;
  }
  return true;
}

function availabilityMatches(
  store: DriverStore,
  driver: DriverProfile,
  request: TransferFulfillmentRequest
) {
  const slots = store.listAvailability(driver.id, request.pickup_date);
  if (slots.length === 0) return false;
  return slots.some((slot) => slot.status === "available");
}

function alreadyAssigned(
  store: DriverStore,
  driverId: string,
  bookingId: string
) {
  return store.listAssignments().some(
    (row) =>
      row.driver_id === driverId &&
      row.booking_id !== bookingId &&
      (row.status === "assigned" || row.status === "accepted")
  );
}

export type EligibilityFailure =
  | "inactive"
  | "unverified"
  | "verification_pending"
  | "rejected"
  | "verification_expired"
  | "verification_revoked"
  | "capacity"
  | "unavailable"
  | "service_area"
  | "capability"
  | "already_assigned"
  | "no_vehicle";

export function eligibilityFailure(
  store: DriverStore,
  driver: DriverProfile,
  request: TransferFulfillmentRequest,
  verification?: VerificationStore
): EligibilityFailure | null {
  if (driver.service_status !== "active") return "inactive";
  const trust = getDriverTrustStatus(driver, verification);
  if (trust !== "verified") {
    if (trust === "unverified") return "unverified";
    return trust;
  }
  if (!areaMatches(driver, request)) return "service_area";
  if (!capabilityMatches(driver, request)) return "capability";
  const vehicle = activeVehicle(store, driver.id);
  if (!vehicle) return "no_vehicle";
  if (!capacityMatches(vehicle, request)) return "capacity";
  if (!availabilityMatches(store, driver, request)) return "unavailable";
  if (alreadyAssigned(store, driver.id, request.booking_id)) return "already_assigned";
  return null;
}

export function findEligibleDrivers(
  request: TransferFulfillmentRequest,
  store: DriverStore = productionStore,
  verification?: VerificationStore
): DriverProfile[] {
  const eligible = store
    .listDrivers()
    .filter((driver) => eligibilityFailure(store, driver, request, verification) === null);
  const preferred = request.preferred_driver_id;
  if (!preferred) {
    return eligible.sort((a, b) => Number(b.preferred) - Number(a.preferred));
  }
  const preferredDriver = eligible.find((row) => row.id === preferred);
  const rest = eligible.filter((row) => row.id !== preferred);
  return preferredDriver ? [preferredDriver, ...rest] : rest;
}

function activeAssignment(store: DriverStore, bookingId: string) {
  return store
    .listAssignments(bookingId)
    .find((row) => row.status === "assigned" || row.status === "accepted");
}

export function assignDriver(
  request: TransferFulfillmentRequest,
  driverId: string,
  actor: DriverActor,
  store: DriverStore = productionStore,
  verification?: VerificationStore
): DriverResult<DriverAssignment> {
  if (!canActorAssign(actor)) {
    return fail("unauthorized", "Travelers and drivers cannot assign a driver.");
  }
  if (!bookingAllowsAssignment(request.booking_status)) {
    return fail(
      "conflict",
      "Driver assignment is only allowed on confirmed or booked transfers."
    );
  }
  const driver = store.getDriver(driverId);
  if (!driver) return fail("not_found", "Driver not found.");
  const trust = getDriverTrustStatus(driver, verification);
  if (trust !== "verified") {
    return fail(
      "verification_required",
      `Driver is not bookable (${trust}). Assignment requires active + verified.`
    );
  }
  const reason = eligibilityFailure(store, driver, request, verification);
  if (reason) {
    return fail("ineligible", `Driver is not eligible (${reason}).`);
  }
  const existing = activeAssignment(store, request.booking_id);
  if (existing) {
    return fail(
      "conflict",
      "Booking already has an active driver. Use reassignDriver."
    );
  }
  const vehicle = activeVehicle(store, driver.id);
  const assignment: DriverAssignment = {
    id: `asg_${crypto.randomUUID()}`,
    booking_id: request.booking_id,
    driver_id: driver.id,
    vehicle_id: vehicle?.id ?? null,
    status: "assigned",
    assigned_by: actor.role === "provider" ? "provider" : actor.role === "admin" ? "admin" : "system",
    note: null,
    created_at: now(),
    updated_at: now(),
  };
  store.saveAssignment(assignment);
  return { ok: true, data: assignment };
}

export function reassignDriver(
  request: TransferFulfillmentRequest,
  driverId: string,
  actor: DriverActor,
  store: DriverStore = productionStore
): DriverResult<DriverAssignment> {
  if (!canActorAssign(actor)) {
    return fail("unauthorized", "Travelers and drivers cannot reassign a driver.");
  }
  const current = activeAssignment(store, request.booking_id);
  if (current) {
    store.updateAssignment(current.id, { status: "reassigned" });
  }
  return assignDriver(request, driverId, actor, store);
}

export function releaseDriver(
  bookingId: string,
  actor: DriverActor,
  store: DriverStore = productionStore
): DriverResult<DriverAssignment> {
  if (!canActorAssign(actor)) {
    return fail("unauthorized", "Travelers cannot release a driver assignment.");
  }
  const current = activeAssignment(store, bookingId);
  if (!current) return fail("not_found", "No active driver assignment.");
  const updated = store.updateAssignment(current.id, { status: "released" });
  return { ok: true, data: updated! };
}

export function acceptAssignment(
  assignmentId: string,
  actor: DriverActor,
  store: DriverStore = productionStore
): DriverResult<DriverAssignment> {
  const assignment = store
    .listAssignments()
    .find((row) => row.id === assignmentId);
  if (!assignment) return fail("not_found", "Assignment not found.");
  if (actor.role === "traveler") {
    return fail("unauthorized", "Travelers cannot accept driver assignments.");
  }
  if (actor.role === "driver" && actor.id !== assignment.driver_id) {
    return fail("unauthorized", "A driver can only accept their own assignment.");
  }
  const updated = store.updateAssignment(assignmentId, { status: "accepted" });
  return { ok: true, data: updated! };
}

export function assignmentDoesNotChangeBookingStatus(): true {
  return true;
}

export function publicMarketplaceSnapshot(store: DriverStore = productionStore) {
  return {
    live_adapters: liveDriverAdapters().length,
    driver_count: store.listDrivers().length,
    assignment_count: store.listAssignments().length,
    public_listing: false,
  };
}

export { productionStore as defaultDriverStore };
