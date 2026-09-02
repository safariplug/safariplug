import { NextResponse } from "next/server";
import { approveAIEvent } from "@/app/admin/ai-events/actions/approve";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const eventId = await approveAIEvent(id);
    return NextResponse.json({ success: true, event_id: eventId });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("SCOUT PUBLISH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish event" },
      { status: 500 }
    );
  }
}
