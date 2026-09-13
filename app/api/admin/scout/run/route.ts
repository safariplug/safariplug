import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EVENT_CATEGORIES } from "@/lib/constants/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const location = String(body.location ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!location) {
    return NextResponse.json({ error: "A Scout destination is required." }, { status: 400 });
  }

  if (!EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
    return NextResponse.json({ error: "A valid Scout category is required." }, { status: 400 });
  }

  // A mission is a durable queue record. Multiple destinations can be queued
  // while another job is processing; workers claim them one at a time.
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
    console.error("SCOUT QUEUE ERROR:", queueError);
    return NextResponse.json({ error: "Could not queue AI Scout mission." }, { status: 500 });
  }

  return NextResponse.json(
    {
      accepted: true,
      queued: true,
      run_id: job.id,
      location: job.location,
      category: job.category,
      status: job.status,
      message: `AI Scout mission queued for ${job.location} / ${job.category}.`,
    },
    { status: 202 }
  );
}
