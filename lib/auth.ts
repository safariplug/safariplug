import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function getCurrentAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');

  if (adminError || isAdmin !== true) {
    return null;
  }

  return user;
}

export async function requireAdmin() {
  const user = await getCurrentAdmin();

  if (!user) {
    redirect('/admin/login');
  }

  return user;
}
