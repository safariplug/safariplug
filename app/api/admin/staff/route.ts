import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminAuthError } from "@/lib/auth/require-admin";
import { ADMIN_ROLES, isAdminRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { supabaseAdmin } from "@/lib/supabase-admin";

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("STAFF API ERROR:", error);
  return NextResponse.json({ error: "Unable to complete staff access request." }, { status: 500 });
}

async function listAuthUsers() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users;
}

export async function GET() {
  try {
    await requireAdmin();

    const { data: rows, error } = await supabaseAdmin
      .from("admin_users")
      .select("user_id, role, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const users = await listAuthUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const staff = (rows || []).map((row) => {
      const user = byId.get(row.user_id);
      const role = isAdminRole(row.role) ? row.role : "super_admin";
      return {
        id: row.user_id,
        email: user?.email || null,
        confirmed: Boolean(user?.email_confirmed_at),
        last_sign_in_at: user?.last_sign_in_at || null,
        role,
        role_label: ROLE_LABELS[role],
        role_description: ROLE_DESCRIPTIONS[role],
        access: true,
      };
    });

    return NextResponse.json({ staff, roles: ADMIN_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role], description: ROLE_DESCRIPTIONS[role] })) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const body = (await request.json()) as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    const role = body.role || "operations_admin";

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid staff email address." }, { status: 400 });
    }
    if (!isAdminRole(role)) {
      return NextResponse.json({ error: "Select a valid staff role." }, { status: 400 });
    }
    if (role === "super_admin") {
      return NextResponse.json({ error: "Super Admin access must be granted deliberately after the account is created." }, { status: 400 });
    }

    const { data: existingAdmin, error: existingAdminError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .limit(1000);
    if (existingAdminError) throw existingAdminError;

    const users = await listAuthUsers();
    const existingUser = users.find((user) => user.email?.toLowerCase() === email);

    if (existingUser) {
      const alreadyAdmin = (existingAdmin || []).some((row) => row.user_id === existingUser.id);
      if (alreadyAdmin) {
        return NextResponse.json({ error: "That email already has SafariPlug staff access." }, { status: 409 });
      }

      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: { ...(existingUser.app_metadata || {}), role },
      });
      if (metadataError) throw metadataError;

      const { error: grantError } = await supabaseAdmin.from("admin_users").insert({ user_id: existingUser.id, role });
      if (grantError) throw grantError;

      return NextResponse.json({ success: true, existing: true, role });
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://safariplug.com"}/admin/login`,
    });
    if (inviteError || !inviteData.user) {
      throw inviteError || new Error("Invitation did not create a user.");
    }

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(inviteData.user.id, {
      app_metadata: { ...(inviteData.user.app_metadata || {}), role },
    });
    if (metadataError) throw metadataError;

    const { error: grantError } = await supabaseAdmin.from("admin_users").insert({ user_id: inviteData.user.id, role });
    if (grantError) throw grantError;

    await supabaseAdmin.from("admin_telemetry_logs").insert({
      action_type: "staff_invited",
      metadata: { invited_user_id: inviteData.user.id, invited_by: currentUser.id, role },
    });

    return NextResponse.json({ success: true, existing: false, role });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    const body = (await request.json()) as { user_id?: string; role?: string };
    const userId = body.user_id;
    const role = body.role;

    if (!userId || !isAdminRole(role)) {
      return NextResponse.json({ error: "Staff user and valid role are required." }, { status: 400 });
    }
    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    if (target.role === "super_admin" && role !== "super_admin") {
      const { count, error: countError } = await supabaseAdmin
        .from("admin_users")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "super_admin");
      if (countError) throw countError;
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "SafariPlug must always have at least one Super Admin." }, { status: 400 });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("admin_users")
      .update({ role })
      .eq("user_id", userId);
    if (updateError) throw updateError;

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUserError) throw authUserError;

    const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { ...(authUser.user.app_metadata || {}), role },
    });
    if (metadataError) throw metadataError;

    await supabaseAdmin.from("admin_telemetry_logs").insert({
      action_type: "staff_role_changed",
      metadata: { user_id: userId, role, changed_by: currentUser.id },
    });

    return NextResponse.json({ success: true, role });
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

    const { data: target, error: targetError } = await supabaseAdmin
      .from("admin_users")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    if (target.role === "super_admin") {
      const { count, error: countError } = await supabaseAdmin
        .from("admin_users")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "super_admin");
      if (countError) throw countError;
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "SafariPlug must always have at least one Super Admin." }, { status: 400 });
      }
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
