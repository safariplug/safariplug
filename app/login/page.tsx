"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type AccountPath = "traveler" | "partner" | "local";

const PATHS: Record<AccountPath, { label: string; eyebrow: string; description: string; destination: string }> = {
  traveler: { label: "Traveler", eyebrow: "Explore & book", description: "Plan trips, save places and request experiences, drivers, services and Locals.", destination: "/account" },
  partner: { label: "Partner / Vendor", eyebrow: "Offer services", description: "For service providers, hotels, restaurants, instructors and other SafariPlug partners.", destination: "/business/services" },
  local: { label: "Local", eyebrow: "Meet travelers", description: "Create your personal Local profile, publish availability and respond to traveler requests.", destination: "/locals/onboarding" },
};

function inferPath(next: string, requested: string | null): AccountPath {
  if (requested === "partner" || requested === "vendor") return "partner";
  if (requested === "local") return "local";
  if (next.startsWith("/business") || next.startsWith("/driver") || next.startsWith("/become-a-")) return "partner";
  if (next.startsWith("/locals/onboarding")) return "local";
  return "traveler";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suppliedNext = searchParams.get("next") || "";
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [accountPath, setAccountPath] = useState<AccountPath>(() => inferPath(suppliedNext, searchParams.get("as")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(searchParams.get("error") || "");

  function safeNext(value: string) { return value.startsWith("/") && !value.startsWith("//") ? value : PATHS[accountPath].destination; }
  function destination() { return suppliedNext ? safeNext(suppliedNext) : PATHS[accountPath].destination; }
  function choosePath(path: AccountPath) { setAccountPath(path); setError(""); setMessage(""); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      if (isSignup) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            data: { full_name: name.trim() || undefined, account_intent: accountPath },
            emailRedirectTo: `https://www.safariplug.com/auth/confirm?next=${encodeURIComponent(destination())}`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) { router.replace(destination()); router.refresh(); return; }
        setMessage(`Account created as ${PATHS[accountPath].label}. Check your email to confirm your account, then sign in.`); setIsSignup(false); return;
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) throw loginError;
      router.replace(destination()); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-black"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-amber-400">Plug</span></Link><Link href="/" className="text-sm font-bold text-zinc-400 hover:text-white">Back to SafariPlug</Link></div></header>
      <section className="flex min-h-[calc(100vh-81px)] items-center justify-center px-6 py-12"><div className="w-full max-w-2xl">
        <div className="mb-8 text-center"><p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">One SafariPlug account</p><h1 className="mt-3 text-4xl font-black">{isSignup ? "How will you use SafariPlug?" : "Welcome back"}</h1><p className="mx-auto mt-3 max-w-xl text-zinc-400">Choose where you want to start. You still use one secure SafariPlug login, and you can use more than one part of SafariPlug over time.</p></div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {(Object.keys(PATHS) as AccountPath[]).map((path) => {
            const item = PATHS[path]; const selected = accountPath === path;
            return <button key={path} type="button" onClick={() => choosePath(path)} aria-pressed={selected} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-800 bg-zinc-950 text-white hover:border-zinc-600"}`}><span className={`text-[10px] font-black uppercase tracking-[.18em] ${selected ? "text-black/55" : "text-zinc-500"}`}>{item.eyebrow}</span><span className="mt-2 block text-base font-black">{item.label}</span><span className={`mt-2 block text-xs leading-5 ${selected ? "text-black/65" : "text-zinc-400"}`}>{item.description}</span></button>;
          })}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
          <div className="mb-5 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-400">{PATHS[accountPath].label}</p><p className="mt-1 text-sm text-zinc-400">{isSignup ? `Create your ${PATHS[accountPath].label.toLowerCase()} account` : `Sign in and continue as ${PATHS[accountPath].label}`}</p></div></div>
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-zinc-900 p-1 text-sm font-bold"><button type="button" onClick={() => { setIsSignup(false); setError(""); setMessage(""); }} className={`rounded-lg px-4 py-2.5 ${!isSignup ? "bg-white text-black" : "text-zinc-400"}`}>Sign in</button><button type="button" onClick={() => { setIsSignup(true); setError(""); setMessage(""); }} className={`rounded-lg px-4 py-2.5 ${isSignup ? "bg-white text-black" : "text-zinc-400"}`}>Create account</button></div>
          <form onSubmit={handleSubmit} className="space-y-5">{isSignup && <div><label htmlFor="name" className="mb-2 block text-sm font-bold">Name</label><input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="Your name" /></div>}<div><label htmlFor="account-email" className="mb-2 block text-sm font-bold">Email address</label><input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="you@example.com" /></div><div><label htmlFor="account-password" className="mb-2 block text-sm font-bold">Password</label><input id="account-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={isSignup ? "new-password" : "current-password"} className="w-full rounded-xl border border-zinc-700 bg-black px-4 py-3.5 outline-none focus:border-amber-400" placeholder="At least 6 characters" /></div>{error && <div role="alert" className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-semibold text-red-300">{error}</div>}{message && <div role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm font-semibold text-emerald-300">{message}</div>}<button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-black text-black hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Please wait..." : isSignup ? `Create ${PATHS[accountPath].label} account` : `Sign in as ${PATHS[accountPath].label}`}</button></form>
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-zinc-500">Traveler, Partner and Local access use the same SafariPlug authentication. Partner and Local features remain subject to their separate onboarding, verification and activation requirements.</p>
      </div></section>
    </main>
  );
}
