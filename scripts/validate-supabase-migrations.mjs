import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const legacyManifest = path.join(root, "ops", "supabase", "legacy-migration-files.txt");
const canonicalCutoff = "20260920014336";

const legacyFiles = fs
  .readFileSync(legacyManifest, "utf8")
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

const currentFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const legacySet = new Set(legacyFiles);
const currentSet = new Set(currentFiles);
const errors = [];

for (const file of legacyFiles) {
  if (!currentSet.has(file)) {
    errors.push(`Legacy migration disappeared without a baseline-normalization update: ${file}`);
  }
}

const additions = currentFiles.filter((file) => !legacySet.has(file));
const versionToFiles = new Map();

for (const file of currentFiles) {
  const match = /^(\d+)_/.exec(file);
  if (!match) continue;
  const version = match[1];
  const existing = versionToFiles.get(version) || [];
  existing.push(file);
  versionToFiles.set(version, existing);
}

for (const file of additions) {
  const match = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/.exec(file);
  if (!match) {
    errors.push(`New migration must use a unique 14-digit UTC timestamp and snake_case name: ${file}`);
    continue;
  }

  const version = match[1];
  if (BigInt(version) <= BigInt(canonicalCutoff)) {
    errors.push(`New migration version must be later than canonical cutoff ${canonicalCutoff}: ${file}`);
  }

  const collisions = versionToFiles.get(version) || [];
  if (collisions.length !== 1) {
    errors.push(`New migration timestamp ${version} is not unique: ${collisions.join(", ")}`);
  }
}

if (errors.length) {
  console.error("Supabase migration guard failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Supabase migration guard passed: ${legacyFiles.length} legacy files grandfathered, ${additions.length} canonical additions validated.`,
);
