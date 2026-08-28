"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("info@safariplug.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!user || !isAdmin) {
      await supabase.auth.signOut();
      setError(
        "Access denied. This account is not authorized for SafariPlug Administration."
      );
      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100">

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">

          <Link
            href="/"
            className="text-2xl font-black tracking-tight"
          >
            Safari<span className="text-orange-500">Plug</span>
          </Link>

          <Link
            href="/"
            className="text-sm font-bold text-slate-500 hover:text-slate-900"
          >
            Back to SafariPlug
          </Link>

        </div>
      </header>

      <section className="flex min-h-[calc(100vh-81px)] items-center justify-center px-6 py-12">

        <div className="w-full max-w-md">

          <div className="mb-8 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
              🔐
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-orange-500">
              SafariPlug Admin
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              Welcome back
            </h1>

            <p className="mt-3 text-slate-500">
              Sign in to manage SafariPlug events.
            </p>

          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              <div>

                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100"
                  placeholder="info@safariplug.com"
                />

              </div>

              <div>

                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100"
                  placeholder="Enter your password"
                />

              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

            </form>

          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            SafariPlug Administration
          </p>

        </div>

      </section>

    </main>
  );
}