"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("error") === "access_denied" ? "This account is not authorized for the SafariPlug staff portal." : "");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    const { data: allowed, error: accessError } = await supabase.rpc("is_staff_portal_user");
    if (accessError || allowed !== true) {
      await supabase.auth.signOut();
      setError("This account is not authorized for the SafariPlug staff portal.");
      setLoading(false);
      return;
    }

    router.replace("/staff");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-amber-400">Plug</span></Link>
          <Link href="/" className="text-sm font-semibold text-zinc-400 hover:text-white">Back to SafariPlug</Link>
        </div>
      </header>

      <section className="flex min-h-[calc(100vh-81px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-2xl text-black">SP</div>
            <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-amber-400">SafariPlug Operations</p>
            <h1 className="mt-2 text-3xl font-black">Admin & Staff Portal</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">Use your authorized SafariPlug staff account. Access is role-controlled after sign-in.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <div>
              <label htmlFor="staff-email" className="mb-2 block text-sm font-bold">Email address</label>
              <input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="name@safariplug.com" />
            </div>
            <div>
              <label htmlFor="staff-password" className="mb-2 block text-sm font-bold">Password</label>
              <input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" />
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">{error}</div>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-black text-black disabled:opacity-50">{loading ? "Signing in..." : "Open staff portal"}</button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-zinc-500">Traveler, partner and Local accounts cannot enter this portal unless an administrator explicitly assigns a SafariPlug staff role.</p>
        </div>
      </section>
    </main>
  );
}
