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

  let body: { location?: unknown; category?: unknown };
  try {
    body = (await request.json()) as { location?: unknown; category?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const location = String(body.location ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!location) {
    return NextResponse.json(
      { error: "A Scout destination is required." },
      { status: 400 }
    );
  }

  if (!category) {
    return NextResponse.json(
      { error: "A Scout category is required." },
      { status: 400 }
    );
  }

  const activeRun = await hasActiveScoutRun();
  if (activeRun) {
    return NextResponse.json(
      {
        error: `${location} / ${category} could not start because another AI Scout mission is already running for ${activeRun.location} / ${activeRun.category}.`,
        requested_location: location,
        requested_category: category,
        active_run_id: activeRun.id,
        active_location: activeRun.location,
        active_category: activeRun.category,
      },
      { status: 409 }
    );
  }

  const leaseOwner = randomUUID();
  const leaseAcquired = await acquireScoutLease(leaseOwner);

  if (!leaseAcquired) {
    return NextResponse.json(
      {
        error: `${location} / ${category} could not start because another AI Scout mission acquired the execution lease first.`,
        requested_location: location,
        requested_category: category,
      },
      { status: 409 }
    );
  }

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
      message: `AI Scout mission started for ${location} / ${category}. Findings will appear after processing completes.`,
    },
    { status: 202 }
  );
}
