import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdminRole, permissionForPath, roleHasPermission } from '@/lib/auth/roles';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLoginRoute = pathname === '/admin/login';

  if (!isAdminRoute || isLoginRoute) {
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const { data: role, error: roleError } = await supabase.rpc('get_admin_role');
  const permission = permissionForPath(pathname);

  if (roleError || !isAdminRole(role) || !roleHasPermission(role, permission)) {
    const url = request.nextUrl.clone();
    url.pathname = permission === 'dashboard' ? '/admin/login' : '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-safariplug-admin-permission', pathname);
  response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
