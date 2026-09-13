import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runAIScout } from "@/app/admin/ai-scout/actions/run-scout";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  acquireScoutLease,
  hasActiveScoutRun,
  releaseScoutLease,
} from "@/lib/ai-scout-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

  if (adminError || isAdmin !== true) {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const activeRun = await hasActiveScoutRun();
  if (activeRun) {
    return NextResponse.json(
      {
        error: `An AI Scout run is already in progress for ${activeRun.location} / ${activeRun.category}. Please wait for it to finish.`,
        run_id: activeRun.id,
      },
      { status: 409 }
    );
  }

  const leaseOwner = randomUUID();
  const leaseAcquired = await acquireScoutLease(leaseOwner);

  if (!leaseAcquired) {
    return NextResponse.json(
      { error: "Another AI Scout run started at the same time. Please try again shortly." },
      { status: 409 }
    );
  }

  let body: { location?: unknown; category?: unknown };
  try {
    body = (await request.json()) as { location?: unknown; category?: unknown };
  } catch {
    await releaseScoutLease(leaseOwner);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const location = String(body.location || "Nairobi").trim();
  const category = String(body.category || "Events & Experiences").trim();
  const formData = new FormData();
  formData.append("location", location);
  formData.append("category", category);

  // Hostinger's nginx gateway can time out before a live-web Scout mission
  // finishes. Start the mission on the persistent Node process and return an
  // acknowledgement immediately; the run itself records completion/failure in
  // ai_scout_runs, and the lease is held until the mission actually finishes.
  void runAIScout(formData)
    .catch((error: unknown) => {
      console.error("SCOUT BACKGROUND RUN ERROR:", error);
    })
    .finally(async () => {
      try {
        await releaseScoutLease(leaseOwner);
      } catch (error) {
        console.error("SCOUT LEASE RELEASE ERROR:", error);
      }
    });

  return NextResponse.json(
    {
      accepted: true,
      location,
      category,
      message: "AI Scout mission started. Findings will appear after processing completes.",
    },
    { status: 202 }
  );
}
