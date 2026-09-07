import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("STAFF API ERROR:", error);
  return NextResponse.json({ error: "Unable to complete staff access request." }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();

    const { data: rows, error } = await supabaseAdmin
      .from("admin_users")
      .select("user_id, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;

    const byId = new Map(usersData.users.map((user) => [user.id, user]));
    const staff = (rows || []).map((row) => {
      const user = byId.get(row.user_id);
      return {
        id: row.user_id,
        email: user?.email || null,
        confirmed: Boolean(user?.email_confirmed_at),
        last_sign_in_at: user?.last_sign_in_at || null,
        access: true,
      };
    });

    return NextResponse.json({ staff });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid staff email address." }, { status: 400 });
    }

    const { data: existingAdmin, error: existingAdminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .limit(1000);
    if (existingAdminError) throw existingAdminError;

    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;

    const existingUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
    if (existingUser) {
      const alreadyAdmin = (existingAdmin || []).some((row) => row.user_id === existingUser.id);
      if (alreadyAdmin) {
        return NextResponse.json({ error: "That email already has SafariPlug admin access." }, { status: 409 });
      }

      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: { ...(existingUser.app_metadata || {}), role: "admin" },
      });
      if (metadataError) throw metadataError;

      const { error: grantError } = await supabaseAdmin.from("admin_users").insert({ user_id: existingUser.id });
      if (grantError) throw grantError;

      return NextResponse.json({ success: true, existing: true });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://safariplug.com"}/admin/login`,
    });
    if (inviteError || !inviteData.user) {
      throw inviteError || new Error("Invitation did not create a user.");
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(inviteData.user.id, {
      app_metadata: { ...(inviteData.user.app_metadata || {}), role: "admin" },
    });
    if (metadataError) throw metadataError;

    const { error: grantError } = await supabaseAdmin.from("admin_users").insert({ user_id: inviteData.user.id });
    if (grantError) throw grantError;

    await supabaseAdmin.from("admin_telemetry_logs").insert({
      action_type: "staff_invited",
      metadata: { invited_user_id: inviteData.user.id, invited_by: currentUser.id },
    });

    return NextResponse.json({ success: true, existing: false });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const userId = new URL(request.url).searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    }

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot revoke your own admin access." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("admin_users").delete().eq("user_id", userId);
    if (error) throw error;

    await supabaseAdmin.from("admin_telemetry_logs").insert({
      action_type: "staff_access_revoked",
      metadata: { user_id: userId, revoked_by: currentUser.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
