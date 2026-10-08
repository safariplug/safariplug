import { spawnSync } from "node:child_process";

const allowedAdvisories = new Set([
  "GHSA-vfj7-8cjw-p6xm", // braces: no patched upstream release as of 2026-10-07
  "GHSA-86w9-cpqp-85rv", // node-forge: no patched upstream release as of 2026-10-07
  "GHSA-w5hq-g745-h8pq", // uuid: Expo 53 CLI chain requires an older major; upgrade with Expo SDK
]);

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error(result.stdout || result.stderr || "Unable to parse npm audit output.");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities || {};
const advisoryId = (entry) => {
  const url = entry?.url || "";
  const match = url.match(/GHSA-[a-z0-9-]+/i);
  return match?.[0] || null;
};

function rootAdvisories(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const vuln = vulnerabilities[name];
  if (!vuln) return [];
  const roots = [];
  for (const via of vuln.via || []) {
    if (typeof via === "string") {
      roots.push(...rootAdvisories(via, seen));
    } else {
      roots.push(via);
    }
  }
  return roots;
}

const blocked = [];
const accepted = [];

for (const [name, vuln] of Object.entries(vulnerabilities)) {
  if (!["high", "critical"].includes(vuln.severity)) continue;
  const roots = rootAdvisories(name);
  const significantRoots = roots.filter((entry) => ["high", "critical"].includes(entry?.severity));
  if (!significantRoots.length) continue;
  const ids = [...new Set(significantRoots.map(advisoryId).filter(Boolean))];
  const allAllowed = ids.length > 0 && ids.every((id) => allowedAdvisories.has(id));
  const row = { name, severity: vuln.severity, advisories: ids };
  if (allAllowed) accepted.push(row);
  else blocked.push(row);
}

if (accepted.length) {
  console.warn("Accepted temporary upstream security exceptions:");
  for (const item of accepted) {
    console.warn(`- ${item.name}: ${item.advisories.join(", ")}`);
  }
}

if (blocked.length) {
  console.error("Unapproved high/critical production dependency vulnerabilities:");
  for (const item of blocked) {
    console.error(`- ${item.name}: ${item.advisories.join(", ") || "unresolved advisory chain"}`);
  }
  process.exit(1);
}

console.log("No unapproved high/critical production dependency vulnerabilities found.");
