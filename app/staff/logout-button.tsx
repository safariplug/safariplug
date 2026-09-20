"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function StaffLogoutButton() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/staff/login");
    router.refresh();
  }

  return <button type="button" onClick={logout} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white">Sign out</button>;
}
