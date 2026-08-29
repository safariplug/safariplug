import { createSupabaseServerClient } from "@/lib/supabase-server";

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
