import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

const FULL_ADMIN_ROLES = new Set(["super_admin", "operations_admin", "finance_manager"]);
const FINANCE_ADMIN_ROLES = new Set(["super_admin", "finance_manager"]);

async function authenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAuthError("Authentication required.", 401);
  }

  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await authenticatedUser();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

  if (adminError) {
    console.error("ADMIN AUTH RPC ERROR:", adminError);
    throw new AdminAuthError("Unable to verify admin access.", 500);
  }

  if (isAdmin !== true) {
    throw new AdminAuthError("Admin access required.", 403);
  }

  return user;
}

export async function requireStaff() {
  const { supabase, user } = await authenticatedUser();
  const { data: isStaff, error: staffError } = await supabase.rpc("is_staff_portal_user");

  if (staffError) {
    console.error("STAFF AUTH RPC ERROR:", staffError);
    throw new AdminAuthError("Unable to verify staff access.", 500);
  }

  if (isStaff !== true) {
    throw new AdminAuthError("SafariPlug staff access required.", 403);
  }

  return user;
}

export function isFullAdminRole(role: unknown) {
  return typeof role === "string" && FULL_ADMIN_ROLES.has(role);
}

export function isFinanceAdminRole(role: unknown) {
  return typeof role === "string" && FINANCE_ADMIN_ROLES.has(role);
}

export async function getAdminRole(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("ADMIN ROLE LOOKUP ERROR:", error);
    throw new AdminAuthError("Unable to verify admin role.", 500);
  }

  return data?.role ? String(data.role) : null;
}

export async function requireFinanceAdmin() {
  const user = await requireAdmin();
  const role = await getAdminRole(user.id);

  if (!isFinanceAdminRole(role)) {
    throw new AdminAuthError("Finance admin access required.", 403);
  }

  return user;
}
