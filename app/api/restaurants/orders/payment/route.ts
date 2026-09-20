import { NextResponse } from "next/server";
import { POST as startRestaurantPayment } from "../pay/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => null) as Record<string, unknown> | null;
  const provider = String(body?.provider || "mpesa");
  if (provider !== "mpesa") {
    return NextResponse.json({ error: "orderId, mpesa provider and idempotencyKey are required" }, { status: 400 });
  }
  return startRestaurantPayment(request);
}
