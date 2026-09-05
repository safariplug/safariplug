import { supabaseAdmin } from "@/lib/supabase-admin";
import type { DriverCapability, DriverProfile, TransferFulfillmentRequest, Vehicle } from "@/lib/integrations/drivers/types";
import { findEligibleDrivers, type DriverStore, MemoryDriverStore } from "./drivers";
import { getDriverTrustStatus } from "./verification";
import { persistAssignment, listPersistedAssignments, listPersistedAvailability, listPersistedDrivers, listPersistedVehicles } from "./driver-store";

export type DriverFulfillmentResult =
  | { ok: true; assignment_id: string; driver: DriverProfile; vehicle: Vehicle | null }
  | { ok: false; reason: "booking_not_found" | "booking_not_assignable" | "no_eligible_driver" | "already_assigned" | "database_error"; message: string };

function normalizeDriver(row: DriverProfile): DriverProfile {
  return row;
}

async function buildStore(request: TransferFulfillmentRequest): Promise<DriverStore> {
  const [drivers, vehicles, availability, assignments] = await Promise.all([
    listPersistedDrivers(),
    listPersistedVehicles(),
    listPersistedAvailability(),
    listPersistedAssignments(),
  ]);
  return new MemoryDriverStore(
    drivers.map(normalizeDriver),
    vehicles,
    availability,
    assignments
  );
}

/**
 * Selects an eligible persisted driver and writes the assignment atomically from
 * the application boundary. It never creates driver inventory and never changes
 * booking status.
 */
export async function assignPersistedDriverForTransfer(input: {
  request: TransferFulfillmentRequest;
  actor: "admin" | "system" | "provider";
}): Promise<DriverFulfillmentResult> {
  const { request } = input;
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("id, status")
    .eq("id", request.booking_id)
    .maybeSingle();

  if (bookingError) {
    return { ok: false, reason: "database_error", message: "Unable to load booking." };
  }
  if (!booking) {
    return { ok: false, reason: "booking_not_found", message: "Booking not found." };
  }
  if (booking.status !== request.booking_status || !["confirmed", "booked"].includes(booking.status)) {
    return { ok: false, reason: "booking_not_assignable", message: "Only confirmed or booked transfers can receive a driver." };
  }

  const existing = await listPersistedAssignments(request.booking_id);
  if (existing.some((row) => row.status === "assigned" || row.status === "accepted")) {
    return { ok: false, reason: "already_assigned", message: "Booking already has an active driver assignment." };
  }

  const store = await buildStore(request);
  const eligible = findEligibleDrivers(request, store);
  if (eligible.length === 0) {
    return { ok: false, reason: "no_eligible_driver", message: "No verified, active driver currently meets the transfer requirements." };
  }

  const selected = eligible[0];
  if (getDriverTrustStatus(selected) !== "verified") {
    return { ok: false, reason: "no_eligible_driver", message: "The selected driver is not verified." };
  }

  const vehicle = store.listVehicles(selected.id).find((row) => row.status === "active") ?? null;
  try {
    const assignment = await persistAssignment({
      booking_id: request.booking_id,
      driver_id: selected.id,
      vehicle_id: vehicle?.id ?? null,
      assigned_by: input.actor,
    });
    return { ok: true, assignment_id: assignment.id, driver: selected, vehicle };
  } catch (error) {
    console.error("DRIVER FULFILLMENT ASSIGNMENT ERROR", error);
    return { ok: false, reason: "database_error", message: "Unable to persist driver assignment." };
  }
}

export async function releasePersistedDriverAssignment(bookingId: string) {
  const assignments = await listPersistedAssignments(bookingId);
  const active = assignments.find((row) => row.status === "assigned" || row.status === "accepted");
  if (!active) return { ok: false as const, message: "No active driver assignment." };
  const updated = await import("./driver-store").then(({ updatePersistedAssignment }) =>
    updatePersistedAssignment(active.id, { status: "released" })
  );
  return { ok: true as const, assignment: updated };
}
