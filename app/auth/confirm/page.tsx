"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your SafariPlug account…");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
          if (!cancelled) setMessage("Your email was confirmed. Please sign in to continue.");
          return;
        }

        const client = createBrowserClient(url, key);
        await new Promise((resolve) => setTimeout(resolve, 700));
        const { data: { session } } = await client.auth.getSession();

        if (cancelled) return;

        if (session?.user) {
          if (session.user.user_metadata?.account_type === "supplier") {
            router.replace("/partner/dashboard");
          } else {
            router.replace("/account");
          }
          router.refresh();
          return;
        }

        setMessage("Your email was confirmed. Please sign in to continue.");
      } catch {
        if (!cancelled) setMessage("Your email was confirmed. Please sign in to continue.");
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">SafariPlug</p>
        <h1 className="mt-3 text-3xl font-black">Email confirmation</h1>
        <p className="mt-4 text-slate-500">{message}</p>
        <Link href="/partner/login" className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-black text-white">
          Continue to partner sign in
        </Link>
      </div>
    </main>
  );
}
