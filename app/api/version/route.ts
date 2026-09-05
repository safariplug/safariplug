import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim()) ?? null;
}

export async function GET() {
  const commit = firstDefined(
    process.env.GIT_COMMIT_SHA,
    process.env.SOURCE_VERSION,
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
  );

  const branch = firstDefined(
    process.env.GIT_BRANCH,
    process.env.GITHUB_REF_NAME,
    process.env.VERCEL_GIT_COMMIT_REF,
  );

  return NextResponse.json({
    service: "SafariPlug",
    version: process.env.npm_package_version ?? "0.1.0",
    commit: commit ? commit.slice(0, 40) : null,
    branch,
  });
}
