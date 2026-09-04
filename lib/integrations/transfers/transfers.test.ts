import assert from "node:assert/strict";
import { test } from "node:test";
import { handleTransferSearch } from "@/lib/api/v1/transfer-handlers";
import {
  mapSupplierTransferQuote,
  parseTransferSearchRequest,
  searchTransfers,
  transferConfirm,
} from "@/lib/services/transfers";
import type { TransferAdapter } from "./adapter";
import { TransferAdapterError, retryIfSafe, withTimeout } from "./errors";
import { UnavailableTransferAdapter } from "./not-configured";
import {
  getTransferAdapter,
  liveTransferAdapters,
  registerTransferAdapter,
  unregisterTransferAdapter,
} from "./registry";
import { NO_TRANSFER_CAPABILITIES } from "./types";
import type { TransferSearchRequest } from "./types";

const SEARCH: TransferSearchRequest = {
  pickup: { kind: "airport", airport_code: "NBO", name: "JKIA" },
  dropoff: { kind: "city", city: "Nairobi", name: "Nairobi" },
  pickup_date: "2026-10-01",
  pickup_time: "09:30",
  timezone: "Africa/Nairobi",
  adults: 2,
  children: 0,
  infants: 0,
  luggage: 2,
  trip_type: "one_way",
  currency: "KES",
};

test("registry adapters are not live and have no capabilities", async () => {
  const adapter = getTransferAdapter("airport_operator");
  assert.equal(adapter.contractImplemented(), false);
  assert.deepEqual(adapter.capabilities(), NO_TRANSFER_CAPABILITIES);
  assert.equal(adapter.status(), "not_configured");
  const result = await adapter.search(SEARCH);
  assert.equal(result.ok, false);
  assert.equal(liveTransferAdapters().length, 0);
});

test("credentials without a contract do not become live", () => {
  process.env.SAFARIPLUG_TRANSFER_AURELIAN_BASE_URL = "https://example.invalid";
  process.env.SAFARIPLUG_TRANSFER_AURELIAN_API_KEY = "not-a-real-secret";
  try {
    const adapter = new UnavailableTransferAdapter("aurelian");
    assert.equal(adapter.credentialsPresent(), true);
    assert.equal(adapter.contractImplemented(), false);
    assert.equal(adapter.status(), "unavailable");
    assert.equal(liveTransferAdapters().length, 0);
  } finally {
    delete process.env.SAFARIPLUG_TRANSFER_AURELIAN_BASE_URL;
    delete process.env.SAFARIPLUG_TRANSFER_AURELIAN_API_KEY;
  }
});

test("search without a live provider invents no vehicles", async () => {
  const result = await searchTransfers(SEARCH);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "not_configured");
});

test("GET /api/v1/transfers/search is 503 without fake inventory", async () => {
  const response = await handleTransferSearch(
    new Request(
      "http://safariplug.local/api/v1/transfers/search?pickup=JKIA&dropoff=Nairobi&pickup_date=2026-10-01"
    )
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as {
    success: boolean;
    error: { code: string };
    data?: unknown;
  };
  assert.equal(body.success, false);
  assert.equal(body.error.code, "transfer_inventory_not_configured");
  assert.equal(body.data, undefined);
});

test("bare search URL is 503 not a Nairobi demo list", async () => {
  const response = await handleTransferSearch(
    new Request("http://safariplug.local/api/v1/transfers/search")
  );
  assert.equal(response.status, 503);
});

test("request normalization preserves location kinds and occupancy", () => {
  const parsed = parseTransferSearchRequest({
    pickup: "JKIA",
    pickup_kind: "airport",
    pickup_airport: "NBO",
    dropoff: "Diani",
    dropoff_kind: "city",
    pickup_date: "2026-12-01",
    pickup_time: "14:00",
    adults: "2",
    luggage: "3",
    trip_type: "round_trip",
  });
  assert.equal(parsed.pickup.kind, "airport");
  assert.equal(parsed.pickup.airport_code, "NBO");
  assert.equal(parsed.dropoff.city, "Diani");
  assert.equal(parsed.adults, 2);
  assert.equal(parsed.luggage, 3);
  assert.equal(parsed.trip_type, "round_trip");
  assert.throws(
    () =>
      parseTransferSearchRequest({
        pickup: "JKIA",
        dropoff: "Diani",
        pickup_date: "01-12-2026",
      }),
    /pickup_date/
  );
});

test("quote mapping keeps supplier amount distinct from markup", () => {
  const mapped = mapSupplierTransferQuote({
    provider: "transport_company",
    transfer_id: "t-1",
    pickup: { kind: "airport", name: "JKIA" },
    dropoff: { kind: "hotel", name: "A hotel" },
    pickup_date: "2026-10-01",
    adults: 1,
    children: 0,
    infants: 0,
    luggage: 1,
    supplier_amount: 40,
    supplier_currency: "USD",
    markup_amount: 6,
    commission_amount: 2,
    tax_amount: 4,
    fee_amount: 1,
  });
  assert.equal(mapped.quote.source, "supplier");
  assert.equal(mapped.quote.supplier_amount, 40);
  assert.equal(mapped.quote.markup_amount, 6);
  assert.equal(mapped.quote.customer_total, 51);
  assert.equal(mapped.quote.customer_currency, "USD");
});

test("currency mismatch is refused", () => {
  assert.throws(
    () =>
      mapSupplierTransferQuote({
        provider: "external_supplier",
        transfer_id: "t",
        pickup: { kind: "city", name: "Nairobi" },
        dropoff: { kind: "city", name: "Mombasa" },
        pickup_date: "2026-10-01",
        adults: 1,
        children: 0,
        infants: 0,
        luggage: 0,
        supplier_amount: 10,
        supplier_currency: "USD",
        currency: "KES",
      }),
    /exchange rates/
  );
});

test("clients cannot confirm a transfer booking", async () => {
  const result = await transferConfirm({
    hold_id: "h1",
    idempotency_key: "idemp",
    traveler_id: "u1",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "contract_required");
});

test("timeouts retry; confirm errors do not", async () => {
  let n = 0;
  await assert.rejects(
    () =>
      retryIfSafe(async () => {
        n += 1;
        throw new TransferAdapterError("timeout", "slow", true);
      }, 2, 1),
    TransferAdapterError
  );
  assert.equal(n, 2);
  let c = 0;
  await assert.rejects(
    () =>
      retryIfSafe(async () => {
        c += 1;
        throw new TransferAdapterError("contract_required", "nope", false);
      }, 3, 1),
    /nope/
  );
  assert.equal(c, 1);
});

test("withTimeout classifies provider timeout", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => undefined), 10, "search"),
    /timed out/
  );
});

test("test-only adapter is unregistered and never seeds production", async () => {
  const fake: TransferAdapter = {
    key: "transport_company",
    name: "Fake (tests only)",
    circuit: "closed",
    capabilities: () => ({ ...NO_TRANSFER_CAPABILITIES, search: true }),
    status: () => "healthy",
    credentialsPresent: () => true,
    contractImplemented: () => true,
    health: async () => ({
      provider: "transport_company",
      status: "healthy",
      configured: true,
      contract_implemented: true,
      reachable: true,
      authenticated: true,
      latency_ms: 1,
      last_success_at: new Date().toISOString(),
      last_error: null,
      checked_at: new Date().toISOString(),
    }),
    search: async () => ({
      ok: true,
      data: {
        provider: "transport_company",
        results: [
          {
            provider: "transport_company",
            transfer_id: "test-only",
            vehicle: {
              category: "sedan",
              name: "Test sedan",
              passenger_capacity: 3,
              luggage_capacity: 2,
              accessibility: false,
              service_mode: "private",
            },
            duration_minutes: 45,
            distance_km: 18,
            cancellation: null,
            currency: "KES",
            total: { amount: 3500, currency: "KES" },
            availability: "available",
            source: "supplier",
          },
        ],
      },
    }),
    availability: async () => ({
      ok: false,
      error: { code: "capability_unsupported", message: "n/a", retryable: false },
    }),
    quote: async () => ({
      ok: false,
      error: { code: "capability_unsupported", message: "n/a", retryable: false },
    }),
    hold: async () => ({
      ok: false,
      error: { code: "capability_unsupported", message: "n/a", retryable: false },
    }),
    confirm: async () => ({
      ok: false,
      error: { code: "contract_required", message: "blocked", retryable: false },
    }),
    cancel: async () => ({
      ok: false,
      error: { code: "capability_unsupported", message: "n/a", retryable: false },
    }),
  };
  registerTransferAdapter("transport_company", () => fake);
  try {
    assert.equal(liveTransferAdapters().length, 1);
    const result = await searchTransfers(SEARCH);
    assert.equal(result.ok, true);
  } finally {
    unregisterTransferAdapter("transport_company");
  }
  assert.equal(liveTransferAdapters().length, 0);
  const production = await searchTransfers(SEARCH);
  assert.equal(production.ok, false);
});

test("safariplug_driver remains a future marketplace slot, not live", async () => {
  const adapter = getTransferAdapter("safariplug_driver");
  assert.equal(adapter.contractImplemented(), false);
  assert.equal(adapter.capabilities().confirm, false);
});
