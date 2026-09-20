import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(
      {
        success: false,
        error: "Legacy AI Sales outreach sending has been retired. Use /admin/ai-sales/invitations for governed outreach.",
      },
      { status: 410 }
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Unable to process legacy outreach request." }, { status: 500 });
  }
}
