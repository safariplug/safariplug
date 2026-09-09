import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("service_appointment_notifications")
    .select("id,appointment_id,type,title,body,status,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [], unreadCount: (data ?? []).filter((item: any) => !item.read_at).length });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "A confirmed SafariPlug account is required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (id) {
    const { error } = await supabaseAdmin.from("service_appointment_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Unable to mark notification as read." }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("service_appointment_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    if (error) return NextResponse.json({ error: "Unable to mark notifications as read." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
