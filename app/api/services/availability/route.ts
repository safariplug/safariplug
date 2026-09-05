import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Parts = { year:number; month:number; day:number; hour:number; minute:number; second:number };
function zonedParts(date: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" }).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { year:get("year"), month:get("month"), day:get("day"), hour:get("hour"), minute:get("minute"), second:get("second") };
}
function localToUtc(dateText: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(guess, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    guess = new Date(guess.getTime() + (desired - asUtc));
  }
  return guess;
}
function dateStringInZone(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { return aStart < bEnd && aEnd > bStart; }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const profileId = url.searchParams.get("serviceProfileId");
    const offeringId = url.searchParams.get("offeringId");
    const date = url.searchParams.get("date");
    if (!profileId || !offeringId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error:"serviceProfileId, offeringId and date are required" }, { status:400 });
    const { data: profile, error: profileError } = await supabaseAdmin.from("service_profiles").select("id,timezone,booking_status,booking_notice_minutes,max_booking_days,status").eq("id",profileId).maybeSingle();
    if (profileError || !profile || profile.status !== "active" || profile.booking_status !== "open") return NextResponse.json({ error:"Service is not currently bookable" }, { status:404 });
    const timeZone = profile.timezone || "Africa/Nairobi";
    const { data: offering } = await supabaseAdmin.from("service_offerings").select("id,duration_minutes,status").eq("id",offeringId).eq("service_profile_id",profileId).maybeSingle();
    if (!offering || offering.status !== "active") return NextResponse.json({ error:"Service is not currently available" }, { status:404 });
    const { data: staffRows } = await supabaseAdmin.from("service_staff").select("id,display_name").eq("service_profile_id",profileId).eq("status","active");
    const staff = staffRows ?? [];
    const staffIds = staff.map(s => s.id);
    if (!staffIds.length) return NextResponse.json({ timeZone, slots:[] });
    const dayStart = localToUtc(date, 0, 0, timeZone);
    const nextDay = new Date(dayStart.getTime() + 36 * 60 * 60 * 1000);
    const dayEnd = localToUtc(dateStringInZone(nextDay, timeZone), 0, 0, timeZone);
    const [{ data: assignments }, { data: blockouts }, { data: availability }] = await Promise.all([
      supabaseAdmin.from("service_staff_offerings").select("staff_id").eq("offering_id",offeringId).in("staff_id",staffIds),
      supabaseAdmin.from("service_staff_blockouts").select("staff_id,starts_at,ends_at").in("staff_id",staffIds).lt("starts_at",dayEnd.toISOString()).gt("ends_at",dayStart.toISOString()),
      supabaseAdmin.from("service_staff_availability").select("staff_id,day_of_week,start_time,end_time,is_active").in("staff_id",staffIds).eq("is_active",true)
    ]);
    const qualified = new Set((assignments ?? []).map(x => x.staff_id));
    const { data: appointments } = await supabaseAdmin.from("service_appointments").select("staff_id,starts_at,ends_at,status").in("staff_id",staffIds).lt("starts_at",dayEnd.toISOString()).gt("ends_at",dayStart.toISOString()).in("status",["pending","confirmed","checked_in","in_progress"]);
    // PostgreSQL stores service_staff_availability day_of_week as 0=Sunday through 6=Saturday.
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const duration = Number(offering.duration_minutes);
    const now = Date.now() + Number(profile.booking_notice_minutes || 0) * 60_000;
    const max = Date.now() + Number(profile.max_booking_days || 90) * 86_400_000;
    const result: { staffId:string; staffName:string; startsAt:string; endsAt:string; label:string }[] = [];
    for (const person of staff) {
      if (!qualified.has(person.id)) continue;
      const windows = (availability ?? []).filter(a => a.staff_id === person.id && Number(a.day_of_week) === weekday);
      for (const window of windows) {
        const [sh,sm] = String(window.start_time).slice(0,5).split(":").map(Number);
        const [eh,em] = String(window.end_time).slice(0,5).split(":").map(Number);
        for (let minutes = sh*60+sm; minutes + duration <= eh*60+em; minutes += 30) {
          const start = localToUtc(date, Math.floor(minutes/60), minutes%60, timeZone);
          const end = new Date(start.getTime() + duration*60_000);
          if (start.getTime() < now || start.getTime() > max) continue;
          if ((blockouts ?? []).some(b => b.staff_id === person.id && overlaps(start,end,new Date(b.starts_at),new Date(b.ends_at)))) continue;
          if ((appointments ?? []).some(a => a.staff_id === person.id && overlaps(start,end,new Date(a.starts_at),new Date(a.ends_at)))) continue;
          result.push({ staffId:person.id, staffName:person.display_name, startsAt:start.toISOString(), endsAt:end.toISOString(), label:new Intl.DateTimeFormat("en",{timeZone,hour:"numeric",minute:"2-digit"}).format(start) });
        }
      }
    }
    result.sort((a,b)=>a.startsAt.localeCompare(b.startsAt) || a.staffName.localeCompare(b.staffName));
    return NextResponse.json({ timeZone, date, durationMinutes:duration, slots:result });
  } catch (error) {
    console.error("service availability", error);
    return NextResponse.json({ error:"Unable to load availability" }, { status:500 });
  }
}
