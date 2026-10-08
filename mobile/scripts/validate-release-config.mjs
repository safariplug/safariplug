import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
const expo = app.expo || {};
const failures = [];

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

requireValue(expo.name === "SafariPlug", "expo.name must be SafariPlug");
requireValue(expo.slug === "safariplug", "expo.slug must be safariplug");
requireValue(expo.scheme === "safariplug", "expo.scheme must be safariplug");
requireValue(expo.ios?.bundleIdentifier === "com.safariplug.app", "iOS bundleIdentifier must be com.safariplug.app");
requireValue(expo.android?.package === "com.safariplug.app", "Android package must be com.safariplug.app");
requireValue(Boolean(expo.icon), "App icon must be configured");
requireValue(Boolean(expo.splash?.image), "Splash image must be configured");
requireValue(Boolean(expo.android?.adaptiveIcon?.foregroundImage), "Android adaptive icon must be configured");

for (const asset of [expo.icon, expo.splash?.image, expo.android?.adaptiveIcon?.foregroundImage].filter(Boolean)) {
  requireValue(fs.existsSync(path.resolve(root, asset)), `Missing release asset: ${asset}`);
}

requireValue(eas.cli?.appVersionSource === "remote", "EAS appVersionSource must be remote");
requireValue(eas.cli?.requireCommit === true, "EAS cli.requireCommit must be true for production releases");
requireValue(Boolean(eas.build?.production), "EAS production build profile is required");
requireValue(eas.build?.production?.autoIncrement === true, "Production builds must auto-increment");
requireValue(eas.build?.production?.android?.buildType === "app-bundle", "Production Android buildType must be app-bundle");

if (failures.length) {
  console.error("SafariPlug mobile release configuration is invalid:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("SafariPlug mobile release configuration is valid.");
