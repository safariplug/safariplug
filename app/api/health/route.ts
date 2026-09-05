import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const { error } = await supabaseAdmin.from("events").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "error",
          latency_ms: Date.now() - startedAt,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "ok",
      latency_ms: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "error",
        latency_ms: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
