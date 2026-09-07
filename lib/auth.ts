import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminRole, permissionForPath, roleHasPermission } from '@/lib/auth/roles';

export async function getCurrentAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: role, error: roleError } = await supabase.rpc('get_admin_role');

  if (roleError || !isAdminRole(role)) {
    return null;
  }

  return user;
}

export async function requireAdmin() {
  const user = await getCurrentAdmin();

  if (!user) {
    redirect('/admin/login');
  }

  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-safariplug-admin-permission');
  const permission = pathname ? permissionForPath(pathname) : 'staff';

  const supabase = await createSupabaseServerClient();
  const { data: role } = await supabase.rpc('get_admin_role');

  if (!isAdminRole(role) || !roleHasPermission(role, permission)) {
    redirect('/admin');
  }

  return user;
}
