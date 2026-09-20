import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const schemaOnly = args[0] === "--schema-only";
const positional = schemaOnly ? args.slice(1) : args;
const [expectedDir, actualDir] = positional;
if (!expectedDir || !actualDir) {
  console.error("Usage: node scripts/compare-supabase-baseline.mjs [--schema-only] <expected-dir> <actual-dir>");
  process.exit(2);
}

const files = [
  "columns.json",
  "constraints-indexes.json",
  "policies-triggers.json",
  "functions.json",
  "api-grants.json",
  ...(schemaOnly ? [] : ["migrations.json"]),
  "schema-meta.json",
];

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "captured_at_utc")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }
  return value;
}

function normalizeColumnOrdinals(value) {
  let tableName = null;
  let position = 0;
  return {
    ...value,
    rows: value.rows.map((row) => {
      if (row.table_name !== tableName) {
        tableName = row.table_name;
        position = 1;
      } else {
        position += 1;
      }
      return { ...row, ordinal_position: position };
    }),
  };
}

function normalizeSchemaMetaForLocal(value) {
  return {
    ...value,
    // Role topology is created by the Supabase platform/local stack, not by
    // SafariPlug migrations, and differs between hosted and local runtimes.
    role_memberships: [],
    // Keep the application-relevant default ACLs for objects created by
    // postgres in public. Other schemas/default owners are platform-managed.
    default_privileges: value.default_privileges
      .filter((row) => row.owner === "postgres" && row.schema === "public")
      .sort((a, b) => {
        const left = `${a.owner}\0${a.schema}\0${a.object_type}`;
        const right = `${b.owner}\0${b.schema}\0${b.object_type}`;
        return left.localeCompare(right);
      }),
  };
}

function collectDiffs(expected, actual, path = "$", out = [], limit = 25) {
  if (out.length >= limit) return out;

  if (Object.is(expected, actual)) return out;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      out.push(`${path}.length: expected ${expected.length}, got ${actual.length}`);
      if (out.length >= limit) return out;
    }
    const length = Math.min(expected.length, actual.length);
    for (let i = 0; i < length && out.length < limit; i += 1) {
      collectDiffs(expected[i], actual[i], `${path}[${i}]`, out, limit);
    }
    return out;
  }

  if (
    expected && actual &&
    typeof expected === "object" &&
    typeof actual === "object" &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  ) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      if (out.length >= limit) break;
      if (!(key in expected)) {
        out.push(`${path}.${key}: unexpected value ${JSON.stringify(actual[key])}`);
      } else if (!(key in actual)) {
        out.push(`${path}.${key}: missing; expected ${JSON.stringify(expected[key])}`);
      } else {
        collectDiffs(expected[key], actual[key], `${path}.${key}`, out, limit);
      }
    }
    return out;
  }

  out.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return out;
}

let failed = false;

for (const file of files) {
  const expectedPath = path.resolve(expectedDir, file);
  const actualPath = path.resolve(actualDir, file);

  if (!fs.existsSync(expectedPath) || !fs.existsSync(actualPath)) {
    console.error(`Missing baseline file: ${file}`);
    failed = true;
    continue;
  }

  let expected = normalize(JSON.parse(fs.readFileSync(expectedPath, "utf8")));
  let actual = normalize(JSON.parse(fs.readFileSync(actualPath, "utf8")));

  if (file === "columns.json") {
    expected = normalizeColumnOrdinals(expected);
    actual = normalizeColumnOrdinals(actual);
  }

  if (schemaOnly && file === "schema-meta.json") {
    expected = normalizeSchemaMetaForLocal(expected);
    actual = normalizeSchemaMetaForLocal(actual);
  }

  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);

  if (left === right) {
    console.log(`PASS ${file}`);
  } else {
    console.error(`FAIL ${file}`);
    for (const diff of collectDiffs(expected, actual)) {
      console.error(`  - ${diff}`);
    }
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Supabase baseline fingerprint comparison passed.");
