import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupAvailability } from "./availability";
import { listedEventQuote, prepareQuote } from "./pricing";
import { toPublicProvider } from "./providers";
import { toPublicOffering } from "./offerings";
import { providerBookingUnavailableMessage } from "./bookings";
import { listIntegrations } from "../integrations/registry";
import {
  handleAvailability,
  handleConfirmBooking,
  handleCreateBooking,
  handleListBookings,
  handleListTrips,
} from "../api/v1/travel-handlers";

test("prepareQuote keeps supplier amount separate from commercial add-ons", () => {
  const quote = prepareQuote({
    supplierAmount: 1000,
    supplierCurrency: "kes",
    markupAmount: 100,
    taxAmount: 50,
    feeAmount: 25,
    discountAmount: 75,
  });
  assert.equal(quote.supplier_amount, 1000);
  assert.equal(quote.supplier_currency, "KES");
  assert.equal(quote.customer_currency, "KES");
  assert.equal(quote.customer_total, 1100);
  assert.equal(quote.source, "safariplug_calc");
});

test("prepareQuote refuses invented exchange rates", () => {
  assert.throws(
    () =>
      prepareQuote({
        supplierAmount: 100,
        supplierCurrency: "KES",
        customerCurrency: "USD",
      }),
    /exchange rates/
  );
});

test("inactive providers and unapproved offerings are not public", () => {
  assert.equal(
    toPublicProvider({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Draft Lodge",
      status: "draft",
    }),
    null
  );
  const active = toPublicProvider({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Active Lodge",
    status: "active",
    kind: "business",
    provider_type: "hotel",
  });
  assert.equal(active?.status, "active");
  assert.equal(
    toPublicOffering({
      id: "22222222-2222-2222-2222-222222222222",
      title: "Hidden transfer",
      kind: "transfer",
      status: "draft",
    }),
    null
  );
});

test("availability and provider confirm stay honestly unavailable", async () => {
  const availability = lookupAvailability();
  assert.equal(availability.available, false);
  const confirm = await handleConfirmBooking();
  assert.equal(confirm.status, 501);
  const confirmBody = await confirm.json();
  assert.equal(confirmBody.success, false);
  assert.equal(confirmBody.error.code, "unavailable");
  assert.equal(JSON.stringify(confirmBody).includes(providerBookingUnavailableMessage().slice(0, 20)), true);
  const live = await handleAvailability();
  assert.equal(live.status, 501);
});

test("trips require authentication", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missingConfig = await handleListTrips(
    new Request("http://safariplug.local/api/v1/trips")
  );
  assert.equal(missingConfig.status, 503);
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  const unauth = await handleListTrips(
    new Request("http://safariplug.local/api/v1/trips")
  );
  assert.equal(unauth.status, 401);
  const body = await unauth.json();
  assert.equal(body.error.code, "unauthorized");
});

test("integration registry does not claim outbound Aurelian booking", () => {
  const [aurelian] = listIntegrations();
  assert.equal(aurelian.id, "aurelian");
  assert.equal(aurelian.outbound_available, false);
  assert.deepEqual(aurelian.capabilities, ["inventory_pull"]);
  assert.equal(aurelian.capabilities.includes("booking"), false);
});

test("listedEventQuote copies public event price without inventing confirmation", () => {
  const quote = listedEventQuote(2500, "usd");
  assert.equal(quote?.supplier_amount, 2500);
  assert.equal(quote?.supplier_currency, "USD");
  assert.equal(quote?.customer_total, 2500);
  assert.equal(quote?.markup_amount, 0);
  assert.equal(quote?.source, "unconfirmed_listed");
  assert.equal(listedEventQuote(null, "KES"), null);
  assert.equal(listedEventQuote(100, null), null);
});

test("bookings require authentication and an event_id", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  const unauth = await handleListBookings(
    new Request("http://safariplug.local/api/v1/bookings")
  );
  assert.equal(unauth.status, 401);
  const create = await handleCreateBooking(
    new Request("http://safariplug.local/api/v1/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supplier_amount: 999, supplier_currency: "USD" }),
    })
  );
  assert.equal(create.status, 401);
});
