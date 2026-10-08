import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function first(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

const commit = first(
  git("rev-parse", "HEAD"),
  process.env.GITHUB_SHA,
  process.env.SOURCE_VERSION,
  process.env.GIT_COMMIT_SHA,
);

const branch = first(
  git("rev-parse", "--abbrev-ref", "HEAD"),
  process.env.GITHUB_REF_NAME,
  process.env.GIT_BRANCH,
);

const output = resolve(process.cwd(), "lib/build-info.generated.ts");
mkdirSync(dirname(output), { recursive: true });

const content =
  `// Generated during prebuild. Do not edit manually.\n` +
  `export const BUILD_COMMIT = ${JSON.stringify(commit)} as const;\n` +
  `export const BUILD_BRANCH = ${JSON.stringify(branch)} as const;\n` +
  `export const BUILD_GENERATED_AT = ${JSON.stringify(new Date().toISOString())} as const;\n`;

writeFileSync(output, content, "utf8");
console.log("Generated SafariPlug build info:", { commit, branch, output });
