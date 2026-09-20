import fs from "node:fs";
import path from "node:path";

const [expectedDir, actualDir] = process.argv.slice(2);
if (!expectedDir || !actualDir) {
  console.error("Usage: node scripts/compare-supabase-baseline.mjs <expected-dir> <actual-dir>");
  process.exit(2);
}

const files = [
  "columns.json",
  "constraints-indexes.json",
  "policies-triggers.json",
  "functions.json",
  "api-grants.json",
  "migrations.json",
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

let failed = false;

for (const file of files) {
  const expectedPath = path.resolve(expectedDir, file);
  const actualPath = path.resolve(actualDir, file);

  if (!fs.existsSync(expectedPath) || !fs.existsSync(actualPath)) {
    console.error(`Missing baseline file: ${file}`);
    failed = true;
    continue;
  }

  const expected = normalize(JSON.parse(fs.readFileSync(expectedPath, "utf8")));
  const actual = normalize(JSON.parse(fs.readFileSync(actualPath, "utf8")));

  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);

  if (left === right) {
    console.log(`PASS ${file}`);
  } else {
    console.error(`FAIL ${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Supabase baseline fingerprint comparison passed.");
