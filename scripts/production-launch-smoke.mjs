const base = (process.env.SAFARIPLUG_BASE_URL || "https://www.safariplug.com").replace(/\/$/, "");
const expectedCommit = (process.env.SAFARIPLUG_EXPECTED_COMMIT || "").trim();
const expectedRoutes = [
  "/",
  "/hotels",
  "/experiences",
  "/activities",
  "/events",
  "/transfers",
  "/drivers",
  "/restaurants",
  "/services",
  "/plan",
  "/concierge",
  "/destinations",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const waitAttempts = Number(process.env.SMOKE_WAIT_ATTEMPTS || 20);
const waitMs = Number(process.env.SMOKE_WAIT_MS || 15000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    redirect: options.redirect || "follow",
    headers: { "user-agent": "SafariPlug-Launch-Smoke/1.0" },
  });
  return response;
}

async function waitForProduction() {
  let lastError = "";
  for (let attempt = 1; attempt <= waitAttempts; attempt += 1) {
    try {
      const response = await request("/");
      const body = await response.text();
      if (response.ok && body.includes("One SafariPlug") && body.includes("Your whole trip")) {
        console.log(`Production responded with current SafariPlug homepage marker on attempt ${attempt}.`);
        return;
      }
      lastError = `HTTP ${response.status}; current homepage marker not found`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < waitAttempts) {
      console.log(`Production not ready yet (attempt ${attempt}/${waitAttempts}): ${lastError}`);
      await sleep(waitMs);
    }
  }
  throw new Error(`Production did not become ready: ${lastError}`);
}

const homepageMarkers = ["One SafariPlug. Your whole trip.", "SafariPlug — One place for your whole trip across Africa"];

const routeMarkers = new Map([
  ["/contact", ["info@safariplug.com", "+254 768 240 096"]],
  ["/about", ["One place to put the whole trip together"]],
  ["/privacy", ["Privacy Policy"]],
  ["/terms", ["Terms of Use"]],
  ["/destinations", ["Start with a destination"]],
  ["/plan", ["Plan the whole journey."]],
  ["/concierge", ["SafariPlug"]],
]);

async function checkPublicRoutes() {
  const failures = [];

  for (const path of expectedRoutes) {
    try {
      const response = await request(path);
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      const usableHtml = contentType.includes("text/html") && body.length > 200 && !/404|not found/i.test(body.slice(0, 1000));

      console.log(`${path}: ${response.status} ${contentType}`);

      if (!response.ok || !usableHtml) {
        failures.push(`${path}: expected usable HTML 200, received ${response.status} ${contentType}`);
        continue;
      }
      const markers = path === "/" ? homepageMarkers : (routeMarkers.get(path) || []);
      for (const marker of markers) {
        if (!body.includes(marker)) failures.push(`${path}: missing expected production marker "${marker}"`);
      }
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return failures;
}

async function checkAccountRedirect() {
  try {
    const response = await request("/account", { redirect: "manual" });
    const location = response.headers.get("location") || "";
    console.log(`/account: ${response.status} -> ${location || "(no location)"}`);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return [`/account: expected auth redirect, received HTTP ${response.status}`];
    }

    if (!location.includes("/login") || !location.includes("next=")) {
      return [`/account: redirect did not preserve login + next destination: ${location}`];
    }
    return [];
  } catch (error) {
    return [`/account: ${error instanceof Error ? error.message : String(error)}`];
  }
}

async function checkVersion() {
  try {
    const response = await request("/api/version");
    const body = await response.json().catch(() => null);
    console.log("/api/version:", response.status, JSON.stringify(body));

    if (!response.ok || body?.service !== "SafariPlug") {
      return [`/api/version: expected SafariPlug JSON response, received HTTP ${response.status}`];
    }
    if (expectedCommit && (typeof body.commit !== "string" || body.commit !== expectedCommit)) {
      return [`/api/version: deployed commit ${JSON.stringify(body.commit)} does not match expected ${expectedCommit}`];
    }
    return [];
  } catch (error) {
    return [`/api/version: ${error instanceof Error ? error.message : String(error)}`];
  }
}

await waitForProduction();

const failures = [
  ...(await checkPublicRoutes()),
  ...(await checkAccountRedirect()),
  ...(await checkVersion()),
];

if (failures.length) {
  console.error("\nSafariPlug production smoke FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nSafariPlug production smoke PASSED.");
console.log("Verified core marketplace routes, Trips/Plan, AI Concierge, trust/legal pages, destination discovery, public contact markers, unauthenticated traveler redirect, and version endpoint.");
