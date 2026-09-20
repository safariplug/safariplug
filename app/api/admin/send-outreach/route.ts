import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json(
      {
        success: false,
        error:
          "The legacy AI Sales outreach sender is retired. Use the governed Partner Invitations workspace, where every message must be reviewed and explicitly approved before sending.",
        replacement: "/admin/ai-sales/invitations",
      },
      { status: 410 }
    );
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to authorize this request." },
      { status: 500 }
    );
  }
}
