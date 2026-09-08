"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PartnerCompletePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Finishing your business account…");

  useEffect(() => {
    let cancelled = false;
    async function complete() {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setMessage("Your email was confirmed. Please sign in to finish your partner account.");
        return;
      }
      const response = await fetch("/api/partner/complete", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        router.replace("/partner/dashboard");
        router.refresh();
      } else if (!cancelled) {
        setMessage(data.error || "We could not finish your business account. Please sign in and try again.");
      }
    }
    void complete();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">SafariPlug Partner</p>
        <h1 className="mt-3 text-3xl font-black">Email confirmed</h1>
        <p className="mt-4 text-slate-500">{message}</p>
        <Link href="/partner/login" className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-black text-white">Partner sign in</Link>
      </div>
    </main>
  );
}
