import { NextResponse } from "next/server";
import { runScheduledSalesScout } from "@/app/admin/ai-sales/actions/run-sales-scout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${configured}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledSalesScout();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("SUPPLIER SCOUT CRON ERROR:", error);
    return NextResponse.json(
      { error: "Supplier Scout failed" },
      { status: 500 }
    );
  }
}
