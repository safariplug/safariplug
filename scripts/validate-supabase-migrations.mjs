import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const versionPath = path.join(root, "ops", "supabase", "canonical-baseline-version.txt");
const filePath = path.join(root, "ops", "supabase", "canonical-baseline-file.txt");
const retiredManifest = path.join(root, "ops", "supabase", "legacy-migration-files-retired-20260920.txt");

const baselineVersion = fs.readFileSync(versionPath, "utf8").trim();
const baselineFile = fs.readFileSync(filePath, "utf8").trim();
const retiredLegacy = new Set(
  fs.readFileSync(retiredManifest, "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean),
);

const currentFiles = fs.readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const errors = [];
if (!/^\d{14}$/.test(baselineVersion)) {
  errors.push(`Canonical baseline version is invalid: ${baselineVersion}`);
}
if (baselineFile !== `${baselineVersion}_production_baseline.sql`) {
  errors.push(`Canonical baseline file mismatch: ${baselineFile}`);
}
if (!currentFiles.includes(baselineFile)) {
  errors.push(`Canonical baseline migration is missing: ${baselineFile}`);
}

for (const file of currentFiles) {
  if (retiredLegacy.has(file)) {
    errors.push(`Retired legacy migration is active again: ${file}`);
  }

  const match = /^(\d{14})_([a-z0-9][a-z0-9_]*)\.sql$/.exec(file);
  if (!match) {
    errors.push(`Migration must use a unique 14-digit UTC timestamp and snake_case name: ${file}`);
    continue;
  }

  const version = match[1];
  if (file !== baselineFile && BigInt(version) <= BigInt(baselineVersion)) {
    errors.push(`Post-baseline migration must be later than ${baselineVersion}: ${file}`);
  }
}

const versions = new Map();
for (const file of currentFiles) {
  const match = /^(\d{14})_/.exec(file);
  if (!match) continue;
  const group = versions.get(match[1]) || [];
  group.push(file);
  versions.set(match[1], group);
}
for (const [version, files] of versions) {
  if (files.length > 1) errors.push(`Migration timestamp ${version} is not unique: ${files.join(", ")}`);
}

if (errors.length) {
  console.error("Supabase migration guard failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Supabase migration guard passed: canonical baseline ${baselineFile}, ${currentFiles.length - 1} post-baseline migrations.`,
);
