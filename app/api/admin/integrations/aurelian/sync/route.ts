import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncApprovedExperiences } from "@/lib/integrations/aurelian";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("AURELIAN SYNC AUTH ERROR");
    return NextResponse.json(
      { success: false, error: "Request failed" },
      { status: 500 }
    );
  }

  try {
    const summary = await syncApprovedExperiences(supabaseAdmin);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    console.error(
      "AURELIAN SYNC ERROR",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(
      {
        success: false,
        error: "Unable to run Aurelian sync.",
      },
      { status: 500 }
    );
  }
}
