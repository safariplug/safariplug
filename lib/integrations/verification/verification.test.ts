import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MemoryDriverStore,
  assignDriver,
  eligibilityFailure,
  findEligibleDrivers,
} from "@/lib/services/drivers";
import {
  MemoryVerificationStore,
  approveCase,
  createVerificationCase,
  expireCase,
  getDriverTrustStatus,
  rejectCase,
  requestReview,
  requiredEvidenceTypes,
  revokeCase,
  submitEvidence,
  toPublicTrustSignal,
  toSafeEvidence,
} from "@/lib/services/verification";
import { liveVerificationAdapters } from "./registry";
import { UnavailableVerificationAdapter } from "./not-configured";
import type { DriverProfile, TransferFulfillmentRequest, Vehicle } from "../drivers/types";

const ADMIN = { role: "admin" as const, id: "admin_1" };
const BOOKING: TransferFulfillmentRequest = {
  booking_id: "bkg_1",
  booking_status: "booked",
  pickup_date: "2026-10-01",
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
    id: "drv_1",
    provider_id: null,
    provider_type: "independent_driver",
    display_name: "Pat",
    contact_ref: "secret_contact",
    service_status: "active",
    verification_state: "unverified",
    preferred: false,
    capabilities: ["airport_transfer"],
    service_area: { city: "Nairobi", airport_code: "NBO" },
    source: "test",
    external_id: null,
    driving_license_expires_on: "2027-10-01",
    driving_license_compliance_status: "valid",
    ...overrides,
  };
}

function vehicle(): Vehicle {
  return {
    id: "veh_1",
    provider_id: null,
    driver_id: "drv_1",
    category: "sedan",
    make_model: null,
    passenger_capacity: 4,
    luggage_capacity: 3,
    accessibility: false,
    status: "active",
    registration_expires_on: "2027-10-01",
    registration_compliance_status: "valid",
    insurance_expires_on: "2027-10-01",
    insurance_compliance_status: "valid",
  };
}

function readyDriverStore(profile: DriverProfile) {
  return new MemoryDriverStore(
    [profile],
    [vehicle()],
    [
      {
        id: "slot_1",
        driver_id: profile.id,
        available_on: "2026-10-01",
        start_time: "08:00",
        end_time: "18:00",
        timezone: "Africa/Nairobi",
        status: "available",
      },
    ]
  );
}

function openedBasicCase(store: MemoryVerificationStore) {
  const created = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1", verification_level: "basic" },
    ADMIN,
    store
  );
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("create");
  const evidence = submitEvidence(
    { case_id: created.data.id, evidence_type: "provider_attestation", storage_ref: "opaque:attestation" },
    ADMIN,
    store
  );
  assert.equal(evidence.ok, true);
  const review = requestReview(created.data.id, ADMIN, store);
  assert.equal(review.ok, true);
  return created.data.id;
}

test("no live KYC adapter; credentials do not become live", async () => {
  assert.equal(liveVerificationAdapters().length, 0);
  process.env.SAFARIPLUG_VERIFY_IDENTITY_PROVIDER_BASE_URL = "https://example.invalid";
  process.env.SAFARIPLUG_VERIFY_IDENTITY_PROVIDER_API_KEY = "not-real";
  try {
    const adapter = new UnavailableVerificationAdapter("identity_provider");
    assert.equal(adapter.credentialsPresent(), true);
    assert.equal(adapter.contractImplemented(), false);
    const check = await adapter.requestExternalCheck("x");
    assert.equal(check.ok, false);
    if (!check.ok) assert.equal(check.error.message, "verification_not_configured");
    assert.equal(liveVerificationAdapters().length, 0);
  } finally {
    delete process.env.SAFARIPLUG_VERIFY_IDENTITY_PROVIDER_BASE_URL;
    delete process.env.SAFARIPLUG_VERIFY_IDENTITY_PROVIDER_API_KEY;
  }
});

test("anonymous and travelers cannot create or read cases", () => {
  const store = new MemoryVerificationStore();
  const anon = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    { role: "anonymous" },
    store
  );
  assert.equal(anon.ok, false);
  if (!anon.ok) assert.equal(anon.error.code, "unauthorized");
  const traveler = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    { role: "traveler", id: "user_1" },
    store
  );
  assert.equal(traveler.ok, false);
  assert.equal(store.listCases().length, 0);
});

test("safe evidence view omits storage refs", () => {
  const store = new MemoryVerificationStore();
  const created = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    ADMIN,
    store
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const submitted = submitEvidence(
    {
      case_id: created.data.id,
      evidence_type: "provider_attestation",
      storage_ref: "private-bucket/secret.pdf",
    },
    ADMIN,
    store
  );
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  assert.equal("storage_ref" in submitted.data, false);
  const json = JSON.stringify(submitted.data);
  assert.equal(json.includes("secret.pdf"), false);
  const safe = toSafeEvidence(store.listEvidence(created.data.id)[0]);
  assert.equal("storage_ref" in safe, false);
});

test("approve requires required evidence; reject and revoke require reasons", () => {
  const store = new MemoryVerificationStore();
  const created = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1", verification_level: "basic" },
    ADMIN,
    store
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.data.id;
  assert.deepEqual(requiredEvidenceTypes("basic"), ["provider_attestation"]);
  requestReview(id, ADMIN, store);
  const premature = approveCase(id, ADMIN, store);
  assert.equal(premature.ok, false);
  if (!premature.ok) assert.equal(premature.error.code, "evidence_required");
  submitEvidence(
    { case_id: id, evidence_type: "provider_attestation" },
    ADMIN,
    store
  );
  const noReason = rejectCase(id, "  ", ADMIN, store);
  assert.equal(noReason.ok, false);
  const rejected = rejectCase(id, "incomplete attestation", ADMIN, store);
  assert.equal(rejected.ok, true);
  assert.equal(
    store.listEvents(id).some((row) => row.event_type === "rejected"),
    true
  );
});

test("controlled approval writes audit events and can verify a driver", () => {
  const store = new MemoryVerificationStore();
  const drivers = readyDriverStore(driver());
  const caseId = openedBasicCase(store);
  const approved = approveCase(caseId, ADMIN, store, drivers);
  assert.equal(approved.ok, true);
  if (!approved.ok) return;
  assert.equal(approved.data.status, "approved");
  assert.equal(drivers.getDriver("drv_1")?.verification_state, "verified");
  const events = store.listEvents(caseId).map((row) => row.event_type);
  assert.ok(events.includes("created"));
  assert.ok(events.includes("submitted"));
  assert.ok(events.includes("in_review"));
  assert.ok(events.includes("approved"));
  assert.equal(getDriverTrustStatus(drivers.getDriver("drv_1")!, store), "verified");
  const signal = toPublicTrustSignal("verified", "basic", "driver");
  assert.equal(signal?.trustBadges.includes("verified_driver"), true);
});

test("unverified pending rejected expired revoked drivers are not eligible", () => {
  const request = BOOKING;
  const unverified = readyDriverStore(driver());
  assert.equal(
    eligibilityFailure(unverified, driver(), request),
    "unverified"
  );
  const pendingStore = new MemoryVerificationStore();
  createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    ADMIN,
    pendingStore
  );
  submitEvidence(
    { case_id: pendingStore.listCases()[0].id, evidence_type: "provider_attestation" },
    ADMIN,
    pendingStore
  );
  const pendingDriver = driver({ verification_state: "pending" });
  assert.equal(
    eligibilityFailure(unverified, pendingDriver, request, pendingStore),
    "verification_pending"
  );
  const rejectedDriver = driver({ verification_state: "rejected" });
  const rejectedStore = new MemoryVerificationStore();
  const opened = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    ADMIN,
    rejectedStore
  );
  if (opened.ok) {
    rejectCase(opened.data.id, "no", ADMIN, rejectedStore);
    assert.equal(
      eligibilityFailure(unverified, rejectedDriver, request, rejectedStore),
      "rejected"
    );
  }
});

test("expired and revoked approved cases are not bookable", () => {
  const drivers = readyDriverStore(driver({ verification_state: "verified" }));
  const store = new MemoryVerificationStore();
  openedBasicCase(store);
  const caseId = store.listCases()[0].id;
  approveCase(caseId, ADMIN, store, drivers);
  expireCase(caseId, ADMIN, store, drivers);
  assert.equal(
    eligibilityFailure(drivers, drivers.getDriver("drv_1")!, BOOKING, store),
    "verification_expired"
  );
  const store2 = new MemoryVerificationStore();
  const drivers2 = readyDriverStore(driver({ verification_state: "verified" }));
  openedBasicCase(store2);
  const id2 = store2.listCases()[0].id;
  approveCase(id2, ADMIN, store2, drivers2);
  const revoked = revokeCase(id2, "safety incident", ADMIN, store2, drivers2);
  assert.equal(revoked.ok, true);
  assert.equal(
    store2.listEvents(id2).some((row) => row.event_type === "revoked"),
    true
  );
  assert.equal(
    eligibilityFailure(drivers2, drivers2.getDriver("drv_1")!, BOOKING, store2),
    "verification_revoked"
  );
  assert.equal(toPublicTrustSignal("verification_revoked", "basic", "driver"), null);
});

test("verified + active driver can be assigned; quotes still cannot", () => {
  const profile = driver({ verification_state: "verified" });
  const drivers = readyDriverStore(profile);
  const eligible = findEligibleDrivers(BOOKING, drivers);
  assert.equal(eligible.length, 1);
  const assigned = assignDriver(BOOKING, "drv_1", { role: "admin" }, drivers);
  assert.equal(assigned.ok, true);
  const quote = assignDriver(
    { ...BOOKING, booking_status: "quote" },
    "drv_1",
    { role: "admin" },
    drivers
  );
  assert.equal(quote.ok, false);
});

test("preferred does not bypass verification", () => {
  const preferred = driver({
    id: "drv_pref",
    preferred: true,
    verification_state: "unverified",
  });
  const drivers = new MemoryDriverStore(
    [preferred],
    [vehicle()],
    []
  );
  assert.deepEqual(findEligibleDrivers({ ...BOOKING, preferred_driver_id: "drv_pref" }, drivers), []);
});

test("travelers cannot self-verify or assign", () => {
  const store = new MemoryVerificationStore();
  const created = createVerificationCase(
    { subject_type: "driver", subject_id: "drv_1" },
    { role: "traveler", id: "user_1" },
    store
  );
  assert.equal(created.ok, false);
  const drivers = readyDriverStore(driver({ verification_state: "verified" }));
  const assigned = assignDriver(
    BOOKING,
    "drv_1",
    { role: "traveler", id: "user_1" },
    drivers
  );
  assert.equal(assigned.ok, false);
});

test("public trust is never granted from active or preferred alone", () => {
  assert.equal(toPublicTrustSignal("unverified", "basic", "driver"), null);
  assert.equal(getDriverTrustStatus(driver({ service_status: "active" })), "unverified");
});
