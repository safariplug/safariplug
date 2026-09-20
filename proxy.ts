import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isStaffRoute = pathname === "/staff" || pathname.startsWith("/staff/");
  const isLoginRoute = pathname === "/admin/login" || pathname === "/staff/login";

  if ((!isAdminRoute && !isStaffRoute) || isLoginRoute) {
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const url = request.nextUrl.clone();
    url.pathname = isStaffRoute ? "/staff/login" : "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const rpcName = isStaffRoute ? "is_staff_portal_user" : "is_admin";
  const { data: allowed, error: accessError } = await supabase.rpc(rpcName);

  if (accessError || allowed !== true) {
    const url = request.nextUrl.clone();
    url.pathname = isStaffRoute ? "/staff/login" : "/admin/login";
    url.search = "error=access_denied";
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
