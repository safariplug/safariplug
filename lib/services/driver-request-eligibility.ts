import { currentCompliance } from "@/lib/services/driver-verification";

export type DriverRequestVehicle = {
  id: string;
  status?: string | null;
  passenger_capacity?: number | null;
  registration_compliance_status?: string | null;
  insurance_compliance_status?: string | null;
};

export function eligibleDriverRequestVehicles(vehicles: DriverRequestVehicle[] | null | undefined) {
  return (vehicles ?? []).filter((vehicle) =>
    vehicle.status === "active" &&
    currentCompliance(vehicle.registration_compliance_status) &&
    currentCompliance(vehicle.insurance_compliance_status)
  );
}

export function knownDriverRequestCapacity(vehicles: DriverRequestVehicle[]) {
  const capacities = vehicles
    .map((vehicle) => Number(vehicle.passenger_capacity))
    .filter((capacity) => Number.isFinite(capacity) && capacity > 0);
  return capacities.length === vehicles.length && capacities.length
    ? Math.max(...capacities)
    : null;
}
