"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PartnerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(searchParams.get("error") || "");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/partner/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link>
          <Link href="/submit" className="text-sm font-bold text-slate-500">Back to business listing</Link>
        </div>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-81px)] max-w-md items-center px-6 py-12">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">SafariPlug Partner Portal</p>
          <h1 className="mt-3 text-3xl font-black">Partner sign in</h1>
          <p className="mt-3 text-slate-500">Manage your business, services, experiences, availability and bookings.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" className="w-full rounded-xl border px-4 py-3" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full rounded-xl border px-4 py-3" />
            {message && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</div>}
            <button disabled={loading} className="w-full rounded-xl bg-slate-950 py-3 font-black text-white disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">New to SafariPlug? <Link href="/partner/signup" className="font-bold text-orange-500">List your business</Link></p>
        </div>
      </section>
    </main>
  );
}
