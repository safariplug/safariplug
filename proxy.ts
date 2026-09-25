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
  const isAccountRoute = pathname === "/account" || pathname.startsWith("/account/");
  const isLoginRoute = pathname === "/admin/login" || pathname === "/staff/login";

  if ((!isAdminRoute && !isStaffRoute && !isAccountRoute) || isLoginRoute) {
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.is_anonymous) {
    const url = request.nextUrl.clone();
    if (isAccountRoute) {
      url.pathname = "/login";
      url.search = `next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    } else {
      const requestedPath = pathname + request.nextUrl.search;
      url.pathname = "/staff/login";
      url.search = `next=${encodeURIComponent(requestedPath)}`;
    }
    return NextResponse.redirect(url);
  }

  if (isAccountRoute) {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (isAdminRoute) {
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || isAdmin !== true) {
      const { data: isStaff } = await supabase.rpc("is_staff_portal_user");
      const url = request.nextUrl.clone();
      url.pathname = isStaff === true ? "/staff" : "/staff/login";
      url.search = isStaff === true ? "" : "error=access_denied";
      return NextResponse.redirect(url);
    }
  } else {
    const { data: allowed, error: accessError } = await supabase.rpc("is_staff_portal_user");
    if (accessError || allowed !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/staff/login";
      url.search = "error=access_denied";
      return NextResponse.redirect(url);
    }
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/account/:path*"],
};
