import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findActiveMission(location: string, category: string) {
  const { data } = await supabaseAdmin
    .from("ai_scout_runs")
    .select("id,location,category,status,queued_at,started_at,worker_stage,provider_status")
    .in("status", ["queued", "running"])
    .eq("category", category)
    .ilike("location", location)
    .not("queued_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { location?: unknown; category?: unknown };
  try {
    body = (await request.json()) as { location?: unknown; category?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const location = String(body.location ?? "").trim().replace(/\s+/g, " ");
  const category = String(body.category ?? "").trim();

  if (!location) {
    return NextResponse.json({ error: "A Scout destination is required." }, { status: 400 });
  }

  if (!EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
    return NextResponse.json({ error: "A valid Scout category is required." }, { status: 400 });
  }

  const active = await findActiveMission(location, category);
  if (active) {
    return NextResponse.json(
      {
        accepted: true,
        queued: active.status === "queued",
        existing: true,
        run_id: active.id,
        location: active.location,
        category: active.category,
        status: active.status,
        worker_stage: active.worker_stage,
        provider_status: active.provider_status,
        message: `An active Scout mission already exists for ${active.location} / ${active.category}.`,
      },
      { status: 200 }
    );
  }

  const { data: job, error: queueError } = await supabaseAdmin
    .from("ai_scout_runs")
    .insert({
      location,
      category,
      status: "queued",
      events_found: 0,
      queued_at: new Date().toISOString(),
      started_at: null,
      claimed_at: null,
      completed_at: null,
      notes: "Queued from SafariPlug Scout Mission Control.",
    })
    .select("id,location,category,status,queued_at")
    .single();

  if (queueError || !job) {
    if (queueError?.code === "23505") {
      const duplicate = await findActiveMission(location, category);
      if (duplicate) {
        return NextResponse.json(
          {
            accepted: true,
            existing: true,
            run_id: duplicate.id,
            location: duplicate.location,
            category: duplicate.category,
            status: duplicate.status,
            worker_stage: duplicate.worker_stage,
            provider_status: duplicate.provider_status,
            message: `An active Scout mission already exists for ${duplicate.location} / ${duplicate.category}.`,
          },
          { status: 200 }
        );
      }
    }
    console.error("SCOUT QUEUE ERROR:", queueError);
    return NextResponse.json({ error: "Could not queue AI Scout mission." }, { status: 500 });
  }

  return NextResponse.json(
    {
      accepted: true,
      queued: true,
      existing: false,
      run_id: job.id,
      location: job.location,
      category: job.category,
      status: job.status,
      message: `AI Scout mission queued for ${job.location} / ${job.category}.`,
    },
    { status: 202 }
  );
}
