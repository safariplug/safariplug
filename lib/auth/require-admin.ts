import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminRole, permissionForPath, roleHasPermission } from "@/lib/auth/roles";

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAuthError("Authentication required.", 401);
  }

  const { data: role, error: roleError } = await supabase.rpc("get_admin_role");

  if (roleError) {
    console.error("ADMIN ROLE RPC ERROR:", roleError);
    throw new AdminAuthError("Unable to verify admin access.", 500);
  }

  if (!isAdminRole(role)) {
    throw new AdminAuthError("Admin access required.", 403);
  }

  const requestHeaders = await headers();
  const permissionHeader = requestHeaders.get("x-safariplug-admin-permission");
  const permission = permissionHeader
    ? permissionForPath(permissionHeader)
    : "staff";

  if (!roleHasPermission(role, permission)) {
    throw new AdminAuthError("You do not have permission to access this area.", 403);
  }

  return user;
}
