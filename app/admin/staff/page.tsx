"use client";

import { FormEvent, useEffect, useState } from "react";

 type StaffUser = {
  id: string;
  email: string | null;
  confirmed: boolean;
  last_sign_in_at: string | null;
  access: boolean;
};

export default function StaffAccessPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/staff", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to load staff.");
    else setStaff(result.staff || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  async function inviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Unable to send invitation.");
    } else {
      setMessage(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      await loadStaff();
    }

    setSending(false);
  }

  async function revokeAccess(userId: string) {
    if (!window.confirm("Revoke SafariPlug admin access for this staff member?")) return;

    setError(null);
    setMessage(null);
    const response = await fetch(`/api/admin/staff?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to revoke access.");
    else {
      setMessage("Staff access revoked. The authentication account remains intact.");
      await loadStaff();
    }
  }

  return (
    <main className="min-h-screen bg-black p-8 font-sans text-white md:p-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <a href="/admin" className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">← Command Center</a>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Staff Access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Invite trusted team members to SafariPlug Administration. Staff access currently uses the existing admin authorization system, so invited staff can access the current admin modules.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Invite staff member</h2>
          <p className="mt-1 text-sm text-zinc-500">They will receive a Supabase invitation and create their own password.</p>
          <form onSubmit={inviteStaff} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              className="flex-1 rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
            />
            <button disabled={sending} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">
              {sending ? "Sending…" : "Send invitation"}
            </button>
          </form>
          {message && <p className="mt-4 text-sm font-semibold text-emerald-400">{message}</p>}
          {error && <p className="mt-4 text-sm font-semibold text-red-400">{error}</p>}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Current staff access</h2>
            <span className="rounded-full bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-400">{staff.length} users</span>
          </div>

          {loading ? <p className="py-8 text-sm text-zinc-500">Loading staff…</p> : (
            <div className="mt-5 divide-y divide-zinc-800">
              {staff.map((user) => (
                <div key={user.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{user.email || "Unknown email"}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {user.confirmed ? "Confirmed" : "Invitation pending"}
                      {user.last_sign_in_at ? ` · Last sign-in ${new Date(user.last_sign_in_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => void revokeAccess(user.id)}
                    className="rounded-xl border border-red-900/60 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-950/40"
                  >
                    Revoke access
                  </button>
                </div>
              ))}
              {staff.length === 0 && <p className="py-8 text-sm text-zinc-500">No staff accounts yet.</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
