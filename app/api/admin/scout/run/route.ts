import { NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";

export async function POST(request: Request) {
  try {
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

  } catch (error: any) {

    console.error(
      "SCOUT RUN ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error.message ||
          "Scout failed"
      },
      {
        status: 500
      }
    );
  }
}