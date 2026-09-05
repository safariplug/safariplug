"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DriverLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push("/driver/application");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#070708] px-6 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-2xl font-black">Safari<span className="text-[#c9a86a]">Plug</span></Link>
        <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#c9a86a]">Driver portal</p>
          <h1 className="mt-3 text-3xl font-black">Sign in</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Check your application status and complete the next onboarding steps.</p>
          <form onSubmit={signIn} className="mt-8 space-y-4">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3" />
            <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3" />
            {error ? <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}
            <button disabled={loading} className="w-full rounded-xl bg-[#c9a86a] py-3 font-black text-black">{loading ? "Signing in..." : "Sign in"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500">Need an account? <Link href="/driver/signup" className="font-bold text-[#c9a86a]">Apply to drive</Link></p>
        </div>
      </div>
    </main>
  );
}
