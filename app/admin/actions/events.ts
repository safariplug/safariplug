import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pathname = new URL(request.url).pathname;

  let update: Record<string, unknown> | null = null;

  if (pathname.endsWith("/approve")) {
    update = {
      status: "approved",
    };
  } else if (pathname.endsWith("/reject")) {
    update = {
      status: "rejected",
    };
  } else if (pathname.endsWith("/pending")) {
    update = {
      status: "pending",
    };
  } else if (pathname.endsWith("/feature")) {
    update = {
      featured: true,
    };
  } else if (pathname.endsWith("/unfeature")) {
    update = {
      featured: false,
    };
  } else if (pathname.endsWith("/delete")) {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete event error:", error);

      return new NextResponse(
        `Unable to delete event: ${error.message}`,
        {
          status: 500,
        }
      );
    }

    return NextResponse.redirect(
      new URL("/admin?status=approved", request.url)
    );
  } else {
    return new NextResponse("Unknown admin action", {
      status: 400,
    });
  }

  const { error } = await supabase
    .from("events")
    .update(update)
    .eq("id", id);

  if (error) {
    console.error("Update event error:", error);

    return new NextResponse(
      `Unable to update event: ${error.message}`,
      {
        status: 500,
      }
    );
  }

  return NextResponse.redirect(
    new URL("/admin?status=approved", request.url)
  );
}