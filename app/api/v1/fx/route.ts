import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const FX_URL = "https://open.er-api.com/v6/latest/USD";

type FxPayload = {
  result?: string;
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  base_code?: string;
  rates?: Record<string, number>;
};

let cached: { payload: FxPayload; expiresAt: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({ success: true, data: cached.payload });
  }

  try {
    const response = await fetch(FX_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!response.ok) {
      throw new Error(`FX provider returned ${response.status}`);
    }

    const payload = (await response.json()) as FxPayload;
    if (payload.result !== "success" || payload.base_code !== "USD" || !payload.rates) {
      throw new Error("Invalid FX provider response");
    }

    cached = { payload, expiresAt: now + 10 * 60 * 1000 };
    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error("FX RATE ERROR:", error);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached.payload,
        stale: true,
      });
    }
    return NextResponse.json(
      { success: false, error: { code: "fx_unavailable", message: "Live exchange rates are temporarily unavailable." } },
      { status: 503 }
    );
  }
}
