import { NextResponse } from "next/server";
import { BUILD_BRANCH, BUILD_COMMIT, BUILD_GENERATED_AT } from "@/lib/build-info.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "SafariPlug",
    version: process.env.npm_package_version ?? "0.1.0",
    commit: BUILD_COMMIT,
    branch: BUILD_BRANCH,
    builtAt: BUILD_GENERATED_AT,
  });
}
