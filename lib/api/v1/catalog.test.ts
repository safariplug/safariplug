import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getApprovedEvent,
  listDestinations,
  listEvents,
  listExperiences,
  searchCatalog,
  type CatalogClient,
} from "./catalog";
import { toPublicEvent } from "./public-event";
import {
  ParamError,
  parseLimit,
  parsePage,
  parseRequiredQuery,
  sanitizeIlike,
  isUuid,
} from "./params";
import { jsonError, jsonOk } from "./http";
import { handleGetEvent, handleSearch } from "./handlers";

const APPROVED_ID = "20fa2e8d-f6ee-43b6-809d-29e523aa4068";
const PENDING_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const NAIROBI_ID = "11111111-1111-1111-1111-111111111111";

const now = new Date("2026-09-10T12:00:00.000Z");
const future = "2026-10-01T18:00:00.000Z";
const later = "2026-11-01T18:00:00.000Z";
const past = "2026-01-01T18:00:00.000Z";

type Row = Record<string, unknown>;

const events: Row[] = [
  {
    id: APPROVED_ID,
    title: "Festivals Kaleidoscope",
    description: "A Nairobi night market",
    category: "Music & Nightlife",
    venue_name: "Uhuru Gardens",
    venue_address: "Langata",
    start_at: future,
    end_at: later,
    price: 0,
    currency: "KES",
    image_url: "https://example.com/k.jpg",
    booking_url: "https://example.com/book",
    organizer_name: "SafariPlug",
    organizer_contact: "SECRET-WHATSAPP",
    submitted_by: "user-1",
    ai_confidence: 0.9,
    source_type: "AI_SCOUT",
    source_url: "https://internal.example/source",
    verified: true,
    is_featured: true,
    status: "approved",
    city: "Nairobi",
    city_id: NAIROBI_ID,
    cities: { id: NAIROBI_ID, name: "Nairobi", country: "Kenya" },
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    title: "Diani Beach Day",
    description: "Coast swim",
    category: "Water Activities",
    venue_name: "Diani Beach",
    start_at: later,
    end_at: null,
    price: 1500,
    currency: "KES",
    is_featured: false,
    status: "approved",
    city: "Diani",
    city_id: "22222222-2222-2222-2222-222222222222",
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    title: "Expired Market",
    description: "already happened",
    category: "Festivals",
    start_at: past,
    end_at: past,
    is_featured: false,
    status: "approved",
    city: "Nairobi",
    city_id: NAIROBI_ID,
  },
  {
    id: PENDING_ID,
    title: "Unpublished Scout Event",
    description: "should never leak",
    category: "Other",
    start_at: future,
    status: "pending",
    organizer_contact: "PRIVATE",
    city: "Nairobi",
    city_id: NAIROBI_ID,
  },
];

const cities: Row[] = [
  { id: NAIROBI_ID, name: "Nairobi", country: "Kenya", active: true },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Diani",
    country: "Kenya",
    active: true,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Staging City",
    country: "Kenya",
    active: false,
  },
];

function like(value: unknown, pattern: string): boolean {
  const text = String(value ?? "").toLowerCase();
  const needle = pattern.replace(/%/g, "").toLowerCase();
  if (!needle) return true;
  return text.includes(needle);
}

function isStillValid(row: Row, nowIso: string): boolean {
  const endAt = typeof row.end_at === "string" ? row.end_at : null;
  const startAt = typeof row.start_at === "string" ? row.start_at : null;
  if (endAt) return endAt >= nowIso;
  if (startAt) return startAt >= nowIso;
  return false;
}

function applyOr(rows: Row[], expr: string, nowIso: string): Row[] {
  if (expr.startsWith("end_at.gte.")) {
    return rows.filter((row) => isStillValid(row, nowIso));
  }
  if (expr.includes("title.ilike.")) {
    const match = expr.match(/title\.ilike\.%([^%]*)%/);
    const q = match?.[1] ?? "";
    return rows.filter(
      (row) =>
        like(row.title, q) ||
        like(row.description, q) ||
        like(row.venue_name, q) ||
        like(row.category, q) ||
        like(row.city, q)
    );
  }
  if (expr.includes("city_id.eq.")) {
    const id = expr.split("city_id.eq.")[1]?.split(",")[0];
    const city = expr.split("city.ilike.")[1] ?? "";
    return rows.filter(
      (row) => row.city_id === id || like(row.city, city)
    );
  }
  return rows;
}

class FakeQuery {
  private table: string;
  private rows: Row[];
  private nowIso: string;
  private ops: Array<() => void> = [];
  private single = false;
  private fromIdx = 0;
  private toIdx = 0;
  private error: string | null = null;

  constructor(table: string, rows: Row[], nowIso: string) {
    this.table = table;
    this.rows = rows;
    this.nowIso = nowIso;
    this.toIdx = Math.max(rows.length - 1, 0);
  }

  select(_columns?: string, _opts?: { count?: string }) {
    return this;
  }
  eq(column: string, value: unknown) {
    this.ops.push(() => {
      this.rows = this.rows.filter((row) => row[column] === value);
    });
    return this;
  }
  ilike(column: string, value: string) {
    this.ops.push(() => {
      this.rows = this.rows.filter((row) => like(row[column], value));
    });
    return this;
  }
  or(expr: string) {
    this.ops.push(() => {
      this.rows = applyOr(this.rows, expr, this.nowIso);
    });
    return this;
  }
  gte(column: string, value: string) {
    this.ops.push(() => {
      this.rows = this.rows.filter(
        (row) => String(row[column] ?? "") >= value
      );
    });
    return this;
  }
  lte(column: string, value: string) {
    this.ops.push(() => {
      this.rows = this.rows.filter(
        (row) => String(row[column] ?? "") <= value
      );
    });
    return this;
  }
  lt(column: string, value: string) {
    this.ops.push(() => {
      this.rows = this.rows.filter((row) => String(row[column] ?? "") < value);
    });
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.ops.push(() => {
      const dir = opts?.ascending === false ? -1 : 1;
      this.rows = [...this.rows].sort((a, b) => {
        const av = String(a[column] ?? "");
        const bv = String(b[column] ?? "");
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      });
    });
    return this;
  }
  range(from: number, to: number) {
    this.fromIdx = from;
    this.toIdx = to;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this.execute();
  }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }
  private execute() {
    for (const op of this.ops) op();
    const sliced = this.rows.slice(this.fromIdx, this.toIdx + 1);
    const payload = this.single
      ? {
          data: sliced[0] ?? null,
          error: this.error ? { message: this.error } : null,
          count: sliced.length,
        }
      : {
          data: sliced,
          error: this.error ? { message: this.error } : null,
          count: this.rows.length,
        };
    return Promise.resolve(payload);
  }
}

function createClient(): CatalogClient {
  const nowIso = now.toISOString();
  return {
    from(table: string) {
      const rows = table === "cities" ? cities.map((row) => ({ ...row })) : events.map((row) => ({ ...row }));
      return new FakeQuery(table, rows, nowIso) as unknown as ReturnType<CatalogClient["from"]>;
    },
  };
}

test("listEvents returns only approved still-valid events", async () => {
  const result = await listEvents(createClient(), {
    page: 1,
    limit: 20,
    when: "valid",
    now,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.every((event) => event.status === "approved"), true);
  assert.equal(
    result.data.some((event) => event.id === PENDING_ID),
    false
  );
  assert.equal(
    result.data.some((event) => event.title === "Expired Market"),
    false
  );
  assert.equal(
    result.data.some((event) => event.id === APPROVED_ID),
    true
  );
});

test("listEvents strips private fields", async () => {
  const result = await listEvents(createClient(), {
    page: 1,
    limit: 20,
    when: "valid",
    now,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const serialized = JSON.stringify(result.data);
  assert.equal(serialized.includes("SECRET-WHATSAPP"), false);
  assert.equal(serialized.includes("organizer_contact"), false);
  assert.equal(serialized.includes("ai_confidence"), false);
  assert.equal(serialized.includes("submitted_by"), false);
  assert.equal(serialized.includes("AI_SCOUT"), false);
});

test("getApprovedEvent returns an approved event", async () => {
  const result = await getApprovedEvent(createClient(), APPROVED_ID);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.title, "Festivals Kaleidoscope");
  assert.equal(result.data.city?.name, "Nairobi");
});

test("getApprovedEvent hides pending events", async () => {
  const result = await getApprovedEvent(createClient(), PENDING_ID);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "not_found");
});

test("getApprovedEvent returns not_found for missing ids", async () => {
  const result = await getApprovedEvent(createClient(), MISSING_ID);
  assert.equal(result.ok, false);
});

test("pagination is bounded and deterministic", async () => {
  const page1 = await listEvents(createClient(), {
    page: 1,
    limit: 1,
    when: "valid",
    now,
  });
  const page2 = await listEvents(createClient(), {
    page: 2,
    limit: 1,
    when: "valid",
    now,
  });
  assert.equal(page1.ok && page2.ok, true);
  if (!page1.ok || !page2.ok) return;
  assert.equal(page1.data.length, 1);
  assert.equal(page2.data.length, 1);
  assert.notEqual(page1.data[0].id, page2.data[0].id);
});

test("search only matches public approved catalog text", async () => {
  const result = await searchCatalog(createClient(), {
    q: "Kaleidoscope",
    page: 1,
    limit: 20,
    now,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, APPROVED_ID);
  const unpublished = await searchCatalog(createClient(), {
    q: "Unpublished",
    page: 1,
    limit: 20,
    now,
  });
  assert.equal(unpublished.ok, true);
  if (!unpublished.ok) return;
  assert.equal(unpublished.data.length, 0);
});

test("destinations come from active cities only", async () => {
  const result = await listDestinations(createClient(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const names = result.data.map((city) => city.name);
  assert.equal(names.includes("Nairobi"), true);
  assert.equal(names.includes("Staging City"), false);
  const nairobi = result.data.find((city) => city.name === "Nairobi");
  assert.ok((nairobi?.event_count ?? 0) >= 1);
});

test("experiences expose website collections and event categories", async () => {
  const result = await listExperiences(createClient(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const slugs = result.data.collections.map((item) => item.slug);
  assert.deepEqual(
    slugs,
    [
      "nightlife",
      "beaches",
      "safari",
      "food",
      "date-night",
      "live-music",
      "hidden-gems",
    ]
  );
  const nightlife = result.data.categories.find(
    (item) => item.name === "Music & Nightlife"
  );
  assert.equal(nightlife?.event_count, 1);
});

test("toPublicEvent refuses non-approved rows", () => {
  assert.equal(
    toPublicEvent({
      id: PENDING_ID,
      title: "nope",
      status: "pending",
      organizer_contact: "x",
    }),
    null
  );
});

test("query param validation", () => {
  assert.equal(parsePage(null), 1);
  assert.throws(() => parsePage("0"), ParamError);
  assert.throws(() => parseLimit("51"), ParamError);
  assert.throws(() => parseRequiredQuery(""), ParamError);
  assert.throws(() => parseRequiredQuery("a".repeat(81)), ParamError);
  assert.equal(sanitizeIlike("foo%bar,baz"), "foo bar baz");
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(APPROVED_ID), true);
});

test("json envelope does not leak internals", async () => {
  const ok = jsonOk({ id: APPROVED_ID });
  const body = await ok.json();
  assert.equal(body.success, true);
  assert.equal(body.data.id, APPROVED_ID);
  const err = jsonError(500, "internal_error", "Unable to load catalog.");
  const errBody = await err.json();
  assert.equal(errBody.success, false);
  assert.equal(JSON.stringify(errBody).includes("SUPABASE"), false);
});

test("invalid event id is 400 before database access", async () => {
  const response = await handleGetEvent(
    new Request("http://safariplug.local/api/v1/events/nope"),
    "nope"
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "bad_request");
});

test("invalid search is 400", async () => {
  const response = await handleSearch(
    new Request("http://safariplug.local/api/v1/search")
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, "bad_request");
});

test("missing supabase config returns 503, not fake data", async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = await handleGetEvent(
    new Request(`http://safariplug.local/api/v1/events/${APPROVED_ID}`),
    APPROVED_ID
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "configuration_error");
});
