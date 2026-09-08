import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function authenticatedUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = typeof body?.expoPushToken === "string" ? body.expoPushToken.trim() : "";
  const platform = typeof body?.platform === "string" ? body.platform : "";
  const deviceName = typeof body?.deviceName === "string" ? body.deviceName.slice(0, 120) : null;
  if (!/^ExponentPushToken\[.+\]$/.test(token)) return NextResponse.json({ error: "A valid Expo push token is required." }, { status: 400 });
  if (!["ios", "android", "web"].includes(platform)) return NextResponse.json({ error: "Unsupported platform." }, { status: 400 });

  const { error } = await supabaseAdmin.from("push_notification_tokens").upsert({ user_id: user.id, expo_push_token: token, platform, device_name: deviceName, enabled: true, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,expo_push_token" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || user.is_anonymous) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = typeof body?.expoPushToken === "string" ? body.expoPushToken.trim() : "";
  if (!token) return NextResponse.json({ error: "Push token is required." }, { status: 400 });
  const { error } = await supabaseAdmin.from("push_notification_tokens").update({ enabled: false, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("expo_push_token", token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
