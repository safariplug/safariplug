"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your SafariPlug account…");

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      await new Promise((resolve) => setTimeout(resolve, 700));
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (session.user.user_metadata?.account_type === "supplier") {
          router.replace("/partner/dashboard");
        } else {
          router.replace("/account");
        }
        router.refresh();
        return;
      }
      if (!cancelled) setMessage("Your email was confirmed. Please sign in to continue.");
    }
    void finish();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">SafariPlug</p>
        <h1 className="mt-3 text-3xl font-black">Email confirmation</h1>
        <p className="mt-4 text-slate-500">{message}</p>
        <Link href="/partner/login" className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Continue to partner sign in</Link>
      </div>
    </main>
  );
}
