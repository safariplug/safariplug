import { NextResponse } from "next/server";
import { runScheduledSalesScout } from "@/app/admin/ai-sales/actions/run-sales-scout";
import { authorizedCronRequest } from "@/lib/auth/cron-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await authorizedCronRequest(request))) {
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
