import { supabaseAdmin } from "@/lib/supabase-admin";
import type { DriverProfile, TransferFulfillmentRequest, Vehicle } from "@/lib/integrations/drivers/types";
import { findEligibleDrivers, type DriverStore, MemoryDriverStore } from "./drivers";
import { getDriverTrustStatus } from "./verification";
import { listDriversAdmin, listVehiclesAdmin, listAvailabilityAdmin, listAssignmentsAdmin, persistAssignmentAdmin, updateAssignmentAdmin } from "./driver-admin";

export type DriverFulfillmentResult =
  | { ok: true; assignment_id: string; driver: DriverProfile; vehicle: Vehicle | null }
  | { ok: false; reason: "booking_not_found" | "booking_not_assignable" | "no_eligible_driver" | "already_assigned" | "database_error"; message: string };

async function buildStore(): Promise<DriverStore> {
  const [drivers, vehicles, availability, assignments] = await Promise.all([
    listDriversAdmin(),
    listVehiclesAdmin(),
    listAvailabilityAdmin(),
    listAssignmentsAdmin(),
  ]);
  return new MemoryDriverStore(drivers, vehicles, availability, assignments);
}

/** Select an eligible persisted driver and persist the assignment. Booking status is never changed here. */
export async function assignPersistedDriverForTransfer(input: {
  request: TransferFulfillmentRequest;
  actor: "admin" | "system" | "provider";
}): Promise<DriverFulfillmentResult> {
  const { request } = input;
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, status")
    .eq("id", request.booking_id)
    .maybeSingle();
  if (error) return { ok: false, reason: "database_error", message: "Unable to load booking." };
  if (!booking) return { ok: false, reason: "booking_not_found", message: "Booking not found." };
  if (booking.status !== request.booking_status || !["confirmed", "booked"].includes(booking.status)) {
    return { ok: false, reason: "booking_not_assignable", message: "Only confirmed or booked transfers can receive a driver." };
  }

  const existing = await listAssignmentsAdmin(request.booking_id);
  if (existing.some((row) => row.status === "assigned" || row.status === "accepted")) {
    return { ok: false, reason: "already_assigned", message: "Booking already has an active driver assignment." };
  }

  const store = await buildStore();
  const eligible = findEligibleDrivers(request, store);
  if (!eligible.length) return { ok: false, reason: "no_eligible_driver", message: "No verified, active driver currently meets the transfer requirements." };

  const selected = eligible[0];
  if (getDriverTrustStatus(selected) !== "verified") {
    return { ok: false, reason: "no_eligible_driver", message: "The selected driver is not verified." };
  }
  const vehicle = store.listVehicles(selected.id).find((row) => row.status === "active") ?? null;

  try {
    const assignment = await persistAssignmentAdmin({ booking_id: request.booking_id, driver_id: selected.id, vehicle_id: vehicle?.id ?? null, assigned_by: input.actor });
    return { ok: true, assignment_id: assignment.id, driver: selected, vehicle };
  } catch (assignmentError) {
    console.error("DRIVER FULFILLMENT ASSIGNMENT ERROR", assignmentError);
    return { ok: false, reason: "database_error", message: "Unable to persist driver assignment." };
  }
}

export async function releasePersistedDriverAssignment(bookingId: string) {
  const assignments = await listAssignmentsAdmin(bookingId);
  const active = assignments.find((row) => row.status === "assigned" || row.status === "accepted");
  if (!active) return { ok: false as const, message: "No active driver assignment." };
  const assignment = await updateAssignmentAdmin(active.id, { status: "released" });
  return { ok: true as const, assignment };
}
