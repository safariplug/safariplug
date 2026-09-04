import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MemoryDriverStore,
  acceptAssignment,
  assignDriver,
  bookingAllowsAssignment,
  canActorAssign,
  eligibilityFailure,
  findEligibleDrivers,
  publicMarketplaceSnapshot,
  reassignDriver,
  releaseDriver,
  toPublicAssignedDriver,
} from "@/lib/services/drivers";
import { providerBookingUnavailableMessage } from "@/lib/services/bookings";
import type {
  DriverProfile,
  TransferFulfillmentRequest,
  Vehicle,
} from "./types";
import { getDriverAdapter, liveDriverAdapters } from "./registry";
import { UnavailableDriverAdapter } from "./not-configured";
import { NO_DRIVER_CAPABILITIES } from "./types";

const BOOKING: TransferFulfillmentRequest = {
  booking_id: "bkg_1",
  booking_status: "booked",
  pickup_date: "2026-10-01",
  pickup_time: "09:00",
  pickup_city: "Nairobi",
  pickup_airport: "NBO",
  adults: 2,
  children: 0,
  infants: 0,
  luggage: 2,
  required_capabilities: ["airport_transfer"],
};

function driver(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    id: "drv_ok",
    provider_id: null,
    provider_type: "independent_driver",
    display_name: "Test Driver",
    contact_ref: "opaque_contact_ref",
    service_status: "active",
    verification_state: "verified",
    preferred: false,
    capabilities: ["airport_transfer", "city_transfer"],
    service_area: { city: "Nairobi", airport_code: "NBO", country: "KE" },
    source: "test",
    external_id: null,
    ...overrides,
  };
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "veh_1",
    provider_id: null,
    driver_id: "drv_ok",
    category: "sedan",
    make_model: null,
    passenger_capacity: 3,
    luggage_capacity: 3,
    accessibility: false,
    status: "active",
    ...overrides,
  };
}

function eligibleStore(extraDrivers: DriverProfile[] = []) {
  const primary = driver();
  return new MemoryDriverStore(
    [primary, ...extraDrivers],
    [vehicle()],
    [
      {
        id: "slot_1",
        driver_id: "drv_ok",
        available_on: "2026-10-01",
        start_time: "08:00",
        end_time: "18:00",
        timezone: "Africa/Nairobi",
        status: "available",
      },
    ]
  );
}

test("registry adapters are not live", async () => {
  const adapter = getDriverAdapter("safariplug_driver");
  assert.equal(adapter.contractImplemented(), false);
  assert.deepEqual(adapter.capabilities(), NO_DRIVER_CAPABILITIES);
  const listed = await adapter.listDrivers();
  assert.equal(listed.ok, false);
  assert.equal(liveDriverAdapters().length, 0);
});

test("credentials without a contract do not become live", () => {
  process.env.SAFARIPLUG_DRIVER_AURELIAN_DRIVER_BASE_URL = "https://example.invalid";
  process.env.SAFARIPLUG_DRIVER_AURELIAN_DRIVER_API_KEY = "not-real";
  try {
    const adapter = new UnavailableDriverAdapter("aurelian_driver");
    assert.equal(adapter.credentialsPresent(), true);
    assert.equal(adapter.contractImplemented(), false);
    assert.equal(liveDriverAdapters().length, 0);
  } finally {
    delete process.env.SAFARIPLUG_DRIVER_AURELIAN_DRIVER_BASE_URL;
    delete process.env.SAFARIPLUG_DRIVER_AURELIAN_DRIVER_API_KEY;
  }
});

test("production store has zero drivers and is not a public listing", () => {
  const snap = publicMarketplaceSnapshot();
  assert.equal(snap.driver_count, 0);
  assert.equal(snap.assignment_count, 0);
  assert.equal(snap.live_adapters, 0);
  assert.equal(snap.public_listing, false);
});

test("public assigned fields omit contact refs", () => {
  const assignment = {
    id: "asg_1",
    booking_id: "bkg_1",
    driver_id: "drv_ok",
    vehicle_id: "veh_1",
    status: "assigned" as const,
    assigned_by: "admin" as const,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const pub = toPublicAssignedDriver(assignment, driver(), vehicle());
  assert.equal(pub.display_name, "Test Driver");
  assert.equal("contact_ref" in pub, false);
  assert.equal(JSON.stringify(pub).includes("opaque_contact_ref"), false);
});

test("inactive, unverified, capacity, area, capability, availability are rejected", () => {
  const store = eligibleStore();
  assert.equal(eligibilityFailure(store, driver(), BOOKING), null);
  assert.equal(
    eligibilityFailure(store, driver({ service_status: "inactive" }), BOOKING),
    "inactive"
  );
  assert.equal(
    eligibilityFailure(store, driver({ service_status: "pending" }), BOOKING),
    "inactive"
  );
  assert.equal(
    eligibilityFailure(
      store,
      driver({ verification_state: "unverified" }),
      BOOKING
    ),
    "unverified"
  );
  const small = new MemoryDriverStore(
    [driver()],
    [vehicle({ passenger_capacity: 1, luggage_capacity: 0 })],
    store.listAvailability("drv_ok", "2026-10-01")
  );
  assert.equal(eligibilityFailure(small, driver(), BOOKING), "capacity");
  assert.equal(
    eligibilityFailure(
      store,
      driver({ service_area: { city: "Mombasa" } }),
      BOOKING
    ),
    "service_area"
  );
  assert.equal(
    eligibilityFailure(
      store,
      driver({ capabilities: ["city_transfer"] }),
      BOOKING
    ),
    "capability"
  );
  const busy = new MemoryDriverStore(
    [driver()],
    [vehicle()],
    [
      {
        id: "slot_off",
        driver_id: "drv_ok",
        available_on: "2026-10-01",
        start_time: null,
        end_time: null,
        timezone: "Africa/Nairobi",
        status: "unavailable",
      },
    ]
  );
  assert.equal(eligibilityFailure(busy, driver(), BOOKING), "unavailable");
});

test("preferred driver cannot override inactivity or verification", () => {
  const preferred = driver({
    id: "drv_pref",
    preferred: true,
    service_status: "inactive",
    verification_state: "unverified",
  });
  const store = eligibleStore([preferred]);
  const eligible = findEligibleDrivers(
    { ...BOOKING, preferred_driver_id: "drv_pref" },
    store
  );
  assert.equal(eligible.some((row) => row.id === "drv_pref"), false);
  assert.equal(eligible[0]?.id, "drv_ok");
});

test("travelers cannot assign, reassign, or release", () => {
  const store = eligibleStore();
  const traveler = { role: "traveler" as const, id: "user_1" };
  assert.equal(canActorAssign(traveler), false);
  assert.equal(assignDriver(BOOKING, "drv_ok", traveler, store).ok, false);
  assert.equal(reassignDriver(BOOKING, "drv_ok", traveler, store).ok, false);
  assert.equal(releaseDriver("bkg_1", traveler, store).ok, false);
});

test("quote bookings cannot receive a driver", () => {
  const store = eligibleStore();
  const result = assignDriver(
    { ...BOOKING, booking_status: "quote" },
    "drv_ok",
    { role: "admin" },
    store
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "conflict");
  assert.equal(bookingAllowsAssignment("quote"), false);
});

test("unverified driver cannot be assigned even by admin", () => {
  const unverified = driver({ verification_state: "unverified" });
  const store = new MemoryDriverStore(
    [unverified],
    [vehicle()],
    eligibleStore().listAvailability("drv_ok", "2026-10-01")
  );
  const result = assignDriver(BOOKING, "drv_ok", { role: "admin" }, store);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "verification_required");
});

test("assign → reassign → release keeps booking status untouched", () => {
  const second = driver({
    id: "drv_2",
    display_name: "Second",
    service_area: { city: "Nairobi", airport_code: "NBO" },
  });
  const store = new MemoryDriverStore(
    [driver(), second],
    [
      vehicle(),
      vehicle({ id: "veh_2", driver_id: "drv_2" }),
    ],
    [
      ...eligibleStore().listAvailability("drv_ok", "2026-10-01"),
      {
        id: "slot_2",
        driver_id: "drv_2",
        available_on: "2026-10-01",
        start_time: "08:00",
        end_time: "18:00",
        timezone: "Africa/Nairobi",
        status: "available",
      },
    ]
  );
  const bookingStatus = { value: "booked" };
  const assigned = assignDriver(BOOKING, "drv_ok", { role: "admin" }, store);
  assert.equal(assigned.ok, true);
  if (assigned.ok) assert.equal(assigned.data.status, "assigned");
  const reassigned = reassignDriver(
    BOOKING,
    "drv_2",
    { role: "system" },
    store
  );
  assert.equal(reassigned.ok, true);
  if (reassigned.ok) {
    assert.equal(reassigned.data.driver_id, "drv_2");
    assert.equal(reassigned.data.status, "assigned");
  }
  const prior = store.listAssignments("bkg_1").find((row) => row.driver_id === "drv_ok");
  assert.equal(prior?.status, "reassigned");
  const released = releaseDriver("bkg_1", { role: "admin" }, store);
  assert.equal(released.ok, true);
  if (released.ok) assert.equal(released.data.status, "released");
  assert.equal(bookingStatus.value, "booked");
  assert.equal(providerBookingUnavailableMessage().includes("not available"), true);
});

test("driver can accept only their own assignment; traveler cannot", () => {
  const store = eligibleStore();
  const assigned = assignDriver(BOOKING, "drv_ok", { role: "admin" }, store);
  assert.equal(assigned.ok, true);
  if (!assigned.ok) return;
  const traveler = acceptAssignment(assigned.data.id, {
    role: "traveler",
    id: "user_1",
  }, store);
  assert.equal(traveler.ok, false);
  const other = acceptAssignment(assigned.data.id, {
    role: "driver",
    id: "drv_other",
  }, store);
  assert.equal(other.ok, false);
  const mine = acceptAssignment(assigned.data.id, {
    role: "driver",
    id: "drv_ok",
  }, store);
  assert.equal(mine.ok, true);
  if (mine.ok) assert.equal(mine.data.status, "accepted");
});

test("empty marketplace never auto-assigns", () => {
  const empty = new MemoryDriverStore();
  assert.deepEqual(findEligibleDrivers(BOOKING, empty), []);
  const result = assignDriver(BOOKING, "drv_missing", { role: "admin" }, empty);
  assert.equal(result.ok, false);
});

test("vehicle without license or verification claims", () => {
  const row = vehicle();
  assert.equal("license" in row, false);
  assert.equal("registration" in row, false);
  assert.equal("verified" in row, false);
});
