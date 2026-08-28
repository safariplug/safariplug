import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
      action: string;
    }>;
  }
) {
  try {
    await requireAdmin();
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("ADMIN ROUTE AUTH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }

  const { id, action } = await context.params;


  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      {
        error: "Invalid action"
      },
      {
        status: 400
      }
    );
  }


  const update =
    action === "approve"
      ? {
          status: "approved",
          review_status: "approved"
        }
      : {
          status: "rejected",
          review_status: "rejected"
        };


  const { data, error } = await supabaseAdmin
    .from("ai_discovered_events")
    .update(update)
    .eq("id", id)
    .select()
    .single();


  if (error) {
    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );
  }


  return NextResponse.json({
    success: true,
    discovery: data
  });
}