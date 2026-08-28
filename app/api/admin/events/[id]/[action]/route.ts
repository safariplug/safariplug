import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST(
  request: Request,
  {
    params,
  }: {
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
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN ROUTE AUTH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 }
    );
  }

  const { id, action } = await params;

  if (!id || !action) {
    return new NextResponse("Missing event ID or action", {
      status: 400,
    });
  }

  if (action === "approve") {
    const { error } = await supabase
      .from("events")
      .update({
        status: "approved",
      })
      .eq("id", id);

    if (error) {
      console.error("Approve event error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else if (action === "reject") {
    const { error } = await supabase
      .from("events")
      .update({
        status: "rejected",
      })
      .eq("id", id);

    if (error) {
      console.error("Reject event error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else if (action === "pending") {
    const { error } = await supabase
      .from("events")
      .update({
        status: "pending",
      })
      .eq("id", id);

    if (error) {
      console.error("Return to pending error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else if (action === "feature") {
    const { error } = await supabase
      .from("events")
      .update({
        featured: true,
      })
      .eq("id", id);

    if (error) {
      console.error("Feature event error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else if (action === "unfeature") {
    const { error } = await supabase
      .from("events")
      .update({
        featured: false,
      })
      .eq("id", id);

    if (error) {
      console.error("Unfeature event error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else if (action === "delete") {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete event error:", error);

      return new NextResponse(error.message, {
        status: 500,
      });
    }
  } else {
    return new NextResponse(
      `Unknown admin action: ${action}`,
      {
        status: 400,
      }
    );
  }

  return NextResponse.redirect(
    new URL("/admin?status=approved", request.url)
  );
}