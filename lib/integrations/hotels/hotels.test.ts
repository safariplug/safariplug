import assert from "node:assert/strict";
import { test } from "node:test";
import { handleHotelSearch } from "@/lib/api/v1/hotel-handlers";
import {
  hotelConfirm,
  mapSupplierQuote,
  parseHotelSearchRequest,
  searchHotels,
} from "@/lib/services/hotels";
import { UnavailableHotelAdapter } from "./not-configured";
import {
  getHotelAdapter,
  liveHotelAdapters,
  registerHotelAdapter,
  unregisterHotelAdapter,
} from "./registry";
import { HotelAdapterError, retryIfSafe, withTimeout } from "./errors";
import type { HotelAdapter } from "./adapter";
import type {
  HotelCapabilities,
  HotelHealth,
  HotelProviderKey,
  HotelSearchRequest,
} from "./types";
import { NO_HOTEL_CAPABILITIES } from "./types";

const SEARCH: HotelSearchRequest = {
  destination: "Nairobi",
  check_in: "2026-10-01",
  check_out: "2026-10-05",
  guests: 2,
  rooms: 1,
  currency: "KES",
};

test("registry returns not-configured adapters with no capabilities", async () => {
  const adapter = getHotelAdapter("booking");
  assert.equal(adapter.contractImplemented(), false);
  assert.deepEqual(adapter.capabilities(), NO_HOTEL_CAPABILITIES);
  assert.equal(adapter.status(), "not_configured");
  const search = await adapter.search(SEARCH);
  assert.equal(search.ok, false);
  if (!search.ok) assert.equal(search.error.code, "not_configured");
  assert.equal(liveHotelAdapters().length, 0);
});

test("missing credentials stay not_configured even if env URL exists alone", () => {
  const previous = process.env.SAFARIPLUG_HOTEL_BOOKING_BASE_URL;
  process.env.SAFARIPLUG_HOTEL_BOOKING_BASE_URL = "https://example.invalid";
  try {
    const adapter = new UnavailableHotelAdapter("booking");
    assert.equal(adapter.credentialsPresent(), false);
    assert.equal(adapter.status(), "not_configured");
  } finally {
    if (previous === undefined) delete process.env.SAFARIPLUG_HOTEL_BOOKING_BASE_URL;
    else process.env.SAFARIPLUG_HOTEL_BOOKING_BASE_URL = previous;
  }
});

test("credentials without an implemented contract do not become live", () => {
  process.env.SAFARIPLUG_HOTEL_EXPEDIA_BASE_URL = "https://example.invalid";
  process.env.SAFARIPLUG_HOTEL_EXPEDIA_API_KEY = "not-a-real-secret-for-git";
  try {
    const adapter = new UnavailableHotelAdapter("expedia");
    assert.equal(adapter.credentialsPresent(), true);
    assert.equal(adapter.contractImplemented(), false);
    assert.equal(adapter.status(), "unavailable");
    assert.equal(liveHotelAdapters().some((row) => row.key === "expedia"), false);
  } finally {
    delete process.env.SAFARIPLUG_HOTEL_EXPEDIA_BASE_URL;
    delete process.env.SAFARIPLUG_HOTEL_EXPEDIA_API_KEY;
  }
});

test("search with no live provider does not invent hotels", async () => {
  const result = await searchHotels(SEARCH);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "not_configured");
    assert.match(result.error.message, /not configured/i);
  }
});

test("public GET /api/v1/hotels is 503 without fake inventory", async () => {
  const response = await handleHotelSearch(
    new Request(
      "http://safariplug.local/api/v1/hotels?destination=Nairobi&check_in=2026-10-01&check_out=2026-10-05"
    )
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as {
    success: boolean;
    error: { code: string };
    data?: unknown;
  };
  assert.equal(body.success, false);
  assert.equal(body.error.code, "hotel_inventory_not_configured");
  assert.equal(body.data, undefined);
});

test("invalid dates are 400 only after a live supplier exists; otherwise 503", async () => {
  const response = await handleHotelSearch(
    new Request("http://safariplug.local/api/v1/hotels?destination=Nairobi")
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(body.error.code, "hotel_inventory_not_configured");
});

test("normalized quote mapping never calls a listed price a supplier rate by accident", () => {
  const mapped = mapSupplierQuote({
    provider: "direct",
    property_id: "prop-1",
    room_id: "room-1",
    rate_id: "rate-1",
    check_in: "2026-10-01",
    check_out: "2026-10-02",
    guests: 1,
    rooms: 1,
    supplier_amount: 120,
    supplier_currency: "USD",
    markup_amount: 10,
    tax_amount: 5,
    fee_amount: 0,
  });
  assert.equal(mapped.quote.source, "supplier");
  assert.equal(mapped.quote.supplier_amount, 120);
  assert.equal(mapped.quote.markup_amount, 10);
  assert.equal(mapped.quote.customer_total, 135);
  assert.equal(mapped.quote.customer_currency, "USD");
});

test("currency mismatch is refused rather than converted", () => {
  assert.throws(
    () =>
      mapSupplierQuote({
        provider: "direct",
        property_id: "p",
        room_id: "r",
        rate_id: null,
        check_in: "2026-10-01",
        check_out: "2026-10-02",
        guests: 1,
        rooms: 1,
        currency: "KES",
        supplier_amount: 10,
        supplier_currency: "USD",
      }),
    /exchange rates/i
  );
});

test("confirm is blocked without a supplier contract", async () => {
  const result = await hotelConfirm({
    hold_id: "hold-1",
    idempotency_key: "abc",
    traveler_id: "user-1",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "contract_required");
});

test("timeouts are retryable; confirmation errors are not retried blindly", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retryIfSafe(async () => {
        calls += 1;
        throw new HotelAdapterError("timeout", "slow", true);
      }, 2, 1),
    HotelAdapterError
  );
  assert.equal(calls, 2);

  let confirmCalls = 0;
  await assert.rejects(
    () =>
      retryIfSafe(async () => {
        confirmCalls += 1;
        throw new HotelAdapterError("contract_required", "nope", false);
      }, 3, 1),
    /nope/
  );
  assert.equal(confirmCalls, 1);
});

test("withTimeout surfaces a timeout error", async () => {
  await assert.rejects(
    () =>
      withTimeout(
        new Promise(() => undefined),
        10,
        "search"
      ),
    /timed out/
  );
});

test("test-only live adapter is used for mapping, then unregistered", async () => {
  const fake: HotelAdapter = {
    key: "direct",
    name: "Fake (tests only)",
    circuit: "closed",
    capabilities: (): HotelCapabilities => ({
      ...NO_HOTEL_CAPABILITIES,
      search: true,
    }),
    status: () => "healthy",
    credentialsPresent: () => true,
    contractImplemented: () => true,
    health: async (): Promise<HotelHealth> => ({
      provider: "direct",
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
    search: async (request) => ({
      ok: true,
      data: {
        provider: "direct" as HotelProviderKey,
        results: [
          {
            provider: "direct",
            property_id: "test-property",
            property_name: `Test stay in ${request.destination}`,
            room_id: "room-1",
            rate_id: "rate-1",
            currency: "KES",
            total: { amount: 9000, currency: "KES" },
            cancellation: "Non-refundable (test)",
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

  registerHotelAdapter("direct", () => fake);
  try {
    assert.equal(liveHotelAdapters().length, 1);
    const result = await searchHotels(SEARCH);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.results[0]?.source, "supplier");
      assert.equal(result.data.results[0]?.provider, "direct");
    }
  } finally {
    unregisterHotelAdapter("direct");
  }
  assert.equal(liveHotelAdapters().length, 0);
  const production = await searchHotels(SEARCH);
  assert.equal(production.ok, false);
});

test("parseHotelSearchRequest validates dates and occupancy", () => {
  const parsed = parseHotelSearchRequest({
    destination: "Diani",
    check_in: "2026-12-01",
    check_out: "2026-12-03",
    guests: "2",
    rooms: "1",
  });
  assert.equal(parsed.destination, "Diani");
  assert.throws(
    () =>
      parseHotelSearchRequest({
        destination: "Diani",
        check_in: "2026-12-03",
        check_out: "2026-12-01",
      }),
    /after check_in/
  );
});

test("aurelian hotel key is scaffolded, not a live hotel source", async () => {
  const adapter = getHotelAdapter("aurelian");
  assert.equal(adapter.contractImplemented(), false);
  const result = await adapter.search(SEARCH);
  assert.equal(result.ok, false);
});
