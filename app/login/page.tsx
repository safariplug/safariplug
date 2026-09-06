"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/account";
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function safeNext(value: string) {
    return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() || undefined } },
        });
        if (signupError) throw signupError;
        if (data.session) {
          router.replace(safeNext(next));
          router.refresh();
          return;
        }
        setMessage("Account created. Check your email to confirm your account, then sign in.");
        setIsSignup(false);
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) throw loginError;
      router.replace(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-amber-400">Plug</span></Link>
          <Link href="/" className="text-sm font-bold text-zinc-400 hover:text-white">Back to SafariPlug</Link>
        </div>
      </header>

      <section className="flex min-h-[calc(100vh-81px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">SafariPlug Traveler</p>
            <h1 className="mt-3 text-4xl font-black">{isSignup ? "Start your journey" : "Welcome back"}</h1>
            <p className="mt-3 text-zinc-400">{isSignup ? "Create a free account to save, plan and book experiences." : "Sign in to manage your saved experiences, journeys and bookings."}</p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <div className="mb-6 grid grid-cols-2 rounded-xl bg-zinc-900 p-1 text-sm font-bold">
              <button type="button" onClick={() => { setIsSignup(false); setError(""); setMessage(""); }} className={`rounded-lg px-4 py-2.5 ${!isSignup ? "bg-white text-black" : "text-zinc-400"}`}>Sign in</button>
              <button type="button" onClick={() => { setIsSignup(true); setError(""); setMessage(""); }} className={`rounded-lg px-4 py-2.5 ${isSignup ? "bg-white text-black" : "text-zinc-400"}`}>Create account</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignup && <div><label htmlFor="name" className="mb-2 block text-sm font-bold">Name</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="Your name" /></div>}
              <div><label htmlFor="traveler-email" className="mb-2 block text-sm font-bold">Email address</label><input id="traveler-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="you@example.com" /></div>
              <div><label htmlFor="traveler-password" className="mb-2 block text-sm font-bold">Password</label><input id="traveler-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={isSignup ? "new-password" : "current-password"} className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="At least 6 characters" /></div>
              {error && <div role="alert" className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">{error}</div>}
              {message && <div role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">{message}</div>}
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Please wait..." : isSignup ? "Create my account" : "Sign in"}</button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-500">Your traveler account is separate from SafariPlug administration.</p>
        </div>
      </section>
    </main>
  );
}
