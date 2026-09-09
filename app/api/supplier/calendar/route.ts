import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function supplierContext() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: account } = await supabaseAdmin.from("supplier_accounts").select("id,user_id,business_id,contact_name,onboarding_status").eq("user_id", user.id).maybeSingle();
  if (!account) return null;
  const { data: profile } = await supabaseAdmin.from("service_profiles").select("id,timezone,booking_status").eq("business_id", account.business_id).maybeSingle();
  if (!profile) return null;
  return { user, account, profile };
}

function isValidUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date().toISOString();
  const to = url.searchParams.get("to") || new Date(Date.now() + 14 * 86400000).toISOString();
  const { data: staff, error: staffError } = await supabaseAdmin.from("service_staff").select("id,display_name,status").eq("service_profile_id", ctx.profile.id).order("created_at");
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  const staffIds = (staff ?? []).map(s => s.id);
  const [availabilityResult, blockoutResult, appointmentsResult] = await Promise.all([
    staffIds.length ? supabaseAdmin.from("service_staff_availability").select("id,staff_id,day_of_week,start_time,end_time,is_active").in("staff_id", staffIds).order("day_of_week").order("start_time") : Promise.resolve({ data: [], error: null }),
    staffIds.length ? supabaseAdmin.from("service_staff_blockouts").select("id,staff_id,starts_at,ends_at,reason").in("staff_id", staffIds).lt("starts_at", to).gt("ends_at", from).order("starts_at") : Promise.resolve({ data: [], error: null }),
    staffIds.length ? supabaseAdmin.from("service_appointments").select("id,public_id,staff_id,customer_name,starts_at,ends_at,status,service_offerings(name)").eq("service_profile_id", ctx.profile.id).in("staff_id", staffIds).lt("starts_at", to).gt("ends_at", from).in("status", ["pending","confirmed","checked_in","in_progress"]).order("starts_at") : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = availabilityResult.error || blockoutResult.error || appointmentsResult.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });
  return NextResponse.json({ timezone: ctx.profile.timezone, staff: staff ?? [], availability: availabilityResult.data ?? [], blockouts: blockoutResult.data ?? [], appointments: appointmentsResult.data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await supplierContext();
  if (!ctx) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  // Approval controls the public catalog/profile; it must not freeze the provider's working calendar.
  // Suppliers need to keep hours and time-off current so availability remains accurate.
  const parsed: unknown = await request.json().catch(() => null);
  const body: Record<string, unknown> = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  const action = typeof body.action === "string" ? body.action : "";
  if (!isValidUuid(body.staffId)) return NextResponse.json({ error: "A valid staff member is required." }, { status: 400 });
  const { data: staff } = await supabaseAdmin.from("service_staff").select("id").eq("id", body.staffId as string).eq("service_profile_id", ctx.profile.id).maybeSingle();
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (action === "availability") {
    const day = Number(body.dayOfWeek); const start = typeof body.startTime === "string" ? body.startTime : ""; const end = typeof body.endTime === "string" ? body.endTime : "";
    if (!Number.isInteger(day) || day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) return NextResponse.json({ error: "Use a valid day and start/end time." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("service_staff_availability").upsert({ staff_id: staff.id, day_of_week: day, start_time: start, end_time: end, is_active: true }, { onConflict: "staff_id,day_of_week,start_time,end_time" }).select("id,staff_id,day_of_week,start_time,end_time,is_active").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, availability: data });
  }
  if (action === "blockout") {
    const startsAt = typeof body.startsAt === "string" ? body.startsAt : ""; const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
    if (!startsAt || !endsAt || new Date(startsAt).getTime() >= new Date(endsAt).getTime()) return NextResponse.json({ error: "A valid start and end time are required." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("service_staff_blockouts").insert({ staff_id: staff.id, starts_at: startsAt, ends_at: endsAt, reason: typeof body.reason === "string" ? body.reason.trim() || null : null }).select("id,staff_id,starts_at,ends_at,reason").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, blockout: data });
  }
  if (action === "delete_availability" || action === "delete_blockout") {
    if (!isValidUuid(body.id)) return NextResponse.json({ error: "A valid calendar item is required." }, { status: 400 });
    const table = action === "delete_availability" ? "service_staff_availability" : "service_staff_blockouts";
    const { error } = await supabaseAdmin.from(table).delete().eq("id", body.id as string).eq("staff_id", staff.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unsupported calendar action." }, { status: 400 });
}
