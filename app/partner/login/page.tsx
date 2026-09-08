"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (loginError) { setError(loginError.message); setLoading(false); return; }
    const accountType = data.user?.user_metadata?.account_type;
    if (accountType && accountType !== "supplier") {
      await supabase.auth.signOut(); setError("This is not a SafariPlug partner account. Use the regular SafariPlug sign in."); setLoading(false); return;
    }
    const response = await fetch("/api/partner/complete", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "We could not finish your partner account."); setLoading(false); return; }
    router.replace("/partner/dashboard"); router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white"><div className="mx-auto max-w-6xl px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link></div></header>
      <section className="mx-auto max-w-md px-6 py-14"><div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-widest text-orange-500">Partner Portal</p>
        <h1 className="mt-3 text-3xl font-black">Partner sign in</h1>
        <p className="mt-3 text-slate-500">Manage your business, services, experiences and bookings.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input required type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
          <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border px-4 py-3" />
          {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <button disabled={loading} className="w-full rounded-xl bg-slate-950 py-3 font-black text-white disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New partner? <Link href="/partner/signup" className="font-bold text-orange-500">Create a business account</Link></p>
      </div></section>
    </main>
  );
}
