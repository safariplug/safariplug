import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.MPESA_B2C_CALLBACK_SECRET?.trim();
  if (!secret || new URL(request.url).searchParams.get("token") !== secret) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    console.warn("M-Pesa B2C queue timeout", body);
  } catch (error) {
    console.error("M-Pesa B2C timeout callback error", error);
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
