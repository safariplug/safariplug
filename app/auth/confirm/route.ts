import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { postAuthDestination } from "@/lib/auth/post-auth-destination";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") || "email") as EmailOtpType;
  const requestedNext = url.searchParams.get("next");

  const supabase = await createSupabaseServerClient();
  let error: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
  } else {
    error = new Error("Missing authentication confirmation token.");
  }

  if (error) {
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "Your email confirmation link is invalid or expired. Please request a new one.");
    return NextResponse.redirect(url);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: isAdmin }, { data: isStaff }] = user
    ? await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_staff_portal_user")])
    : [{ data: false }, { data: false }];

  const destination = postAuthDestination({
    isAdmin: isAdmin === true,
    isStaff: isStaff === true,
    next: requestedNext,
    accountIntent: user?.user_metadata?.account_intent,
    accountType: user?.user_metadata?.account_type,
  });
  return NextResponse.redirect(new URL(destination, url.origin));
}
