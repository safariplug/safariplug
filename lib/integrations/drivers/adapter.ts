import type {
  DriverActor,
  DriverAssignment,
  DriverAvailabilitySlot,
  DriverCapabilities,
  DriverHealth,
  DriverProfile,
  DriverProviderStatus,
  DriverProviderType,
  DriverResult,
  TransferFulfillmentRequest,
} from "./types";

export interface DriverAdapter {
  readonly key: DriverProviderType;
  readonly name: string;
  capabilities(): DriverCapabilities;
  status(): DriverProviderStatus;
  credentialsPresent(): boolean;
  contractImplemented(): boolean;
  health(): Promise<DriverHealth>;
  listDrivers(): Promise<DriverResult<DriverProfile[]>>;
  getDriver(id: string): Promise<DriverResult<DriverProfile>>;
  availability(
    driverId: string,
    onDate: string
  ): Promise<DriverResult<DriverAvailabilitySlot[]>>;
  assign(
    request: TransferFulfillmentRequest,
    driverId: string,
    actor: DriverActor
  ): Promise<DriverResult<DriverAssignment>>;
  unassign(
    assignmentId: string,
    actor: DriverActor
  ): Promise<DriverResult<DriverAssignment>>;
}

export const DRIVER_PROVIDER_NAMES: Record<DriverProviderType, string> = {
  independent_driver: "Independent driver",
  safariplug_driver: "SafariPlug driver marketplace",
  transport_company: "Transport company",
  hotel_driver: "Hotel / operator driver",
  tour_operator: "Tour operator",
  aurelian_driver: "Aurelian operator",
  external_driver_provider: "External driver platform",
};
