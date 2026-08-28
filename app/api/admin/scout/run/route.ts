import { NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import {
  AdminAuthError,
  requireAdmin,
} from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const formData = new FormData();

    formData.append(
      "location",
      body.location || "Nairobi"
    );

    formData.append(
      "category",
      body.category || "Events & Experiences"
    );

    await runAIScout(formData);

    return NextResponse.json({
      success: true,
      message: "AI Scout completed successfully.",
    });

  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error(
      "SCOUT RUN ERROR:",
      error
    );

    const message =
      error instanceof Error ? error.message : "Scout failed";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}