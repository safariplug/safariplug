"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AccountSessionControls({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login?next=%2Faccount");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/60">
        Signed in as {email}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
      >
        Sign out
      </button>
    </div>
  );
}
