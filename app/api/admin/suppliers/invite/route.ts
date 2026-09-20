import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(
      {
        success: false,
        error: "Direct supplier invitations are disabled. Start from Organization 360 and use governed outreach so the prospect, invitation, supplier account, and Partner 360 stay linked.",
        next: "/admin/ai-sales",
      },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to start supplier recruitment." },
      { status: 500 },
    );
  }
}
