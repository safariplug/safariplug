import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_AUDIENCE = "https://safariplug.com";
const GITHUB_REPOSITORY = "safariplug/safariplug";
const GITHUB_REPOSITORY_ID = "1336742282";
const GITHUB_REPOSITORY_OWNER_ID = "307028781";
const GITHUB_MAIN_REF = "refs/heads/main";

const githubJwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim();
}

async function verifyGitHubActionsOidc(token: string) {
  try {
    const { payload } = await jwtVerify(token, githubJwks, {
      issuer: GITHUB_ISSUER,
      audience: GITHUB_AUDIENCE,
    });

    const eventName = String(payload.event_name || "");
    const allowedEvent = ["push", "schedule", "workflow_dispatch"].includes(eventName);

    return (
      payload.repository === GITHUB_REPOSITORY &&
      String(payload.repository_id || "") === GITHUB_REPOSITORY_ID &&
      String(payload.repository_owner_id || "") === GITHUB_REPOSITORY_OWNER_ID &&
      payload.ref === GITHUB_MAIN_REF &&
      allowedEvent
    );
  } catch {
    return false;
  }
}

export async function authorizedCronRequest(request: Request) {
  const token = bearerToken(request);
  if (!token) return false;

  const configured = process.env.CRON_SECRET?.trim();
  if (configured && token === configured) return true;

  return verifyGitHubActionsOidc(token);
}
