"use client";

import { FormEvent, useEffect, useState } from "react";

type Role = {
  value: string;
  label: string;
  description: string;
};

type StaffUser = {
  id: string;
  email: string | null;
  confirmed: boolean;
  last_sign_in_at: string | null;
  role: string;
  role_label: string;
  role_description: string;
  access: boolean;
};

export default function StaffAccessPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operations_admin");
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
    else {
      setStaff(result.staff || []);
      setRoles(result.roles || []);
    }
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
      body: JSON.stringify({ email: email.trim(), role }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Unable to send invitation.");
    } else {
      setMessage(`Invitation sent to ${email.trim()} as ${roles.find((item) => item.value === role)?.label || role}.`);
      setEmail("");
      await loadStaff();
    }

    setSending(false);
  }

  async function changeRole(userId: string, nextRole: string) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: nextRole }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to change staff role.");
    else {
      setMessage("Staff role updated.");
      await loadStaff();
    }
  }

  async function revokeAccess(userId: string) {
    if (!window.confirm("Revoke SafariPlug access for this staff member?")) return;

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
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-zinc-800 pb-6">
          <a href="/admin" className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">← Command Center</a>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Staff Access</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Invite team members with the minimum SafariPlug access they need. Super Admin is reserved for full platform administration.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-lg font-bold">Invite staff member</h2>
          <p className="mt-1 text-sm text-zinc-500">They will receive a Supabase invitation and create their own password.</p>
          <form onSubmit={inviteStaff} className="mt-5 grid gap-3 md:grid-cols-[1fr_280px_auto]">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              className="rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
            />
            <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-zinc-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-amber-400">
              {roles.filter((item) => item.value !== "super_admin").map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <button disabled={sending} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-black disabled:opacity-50">
              {sending ? "Sending…" : "Send invitation"}
            </button>
          </form>
          {roles.find((item) => item.value === role) && <p className="mt-3 text-xs text-zinc-500">{roles.find((item) => item.value === role)?.description}</p>}
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
                <div key={user.id} className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{user.email || "Unknown email"}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {user.confirmed ? "Confirmed" : "Invitation pending"}
                      {user.last_sign_in_at ? ` · Last sign-in ${new Date(user.last_sign_in_at).toLocaleString()}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">{user.role_description}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={user.role}
                      onChange={(event) => void changeRole(user.id, event.target.value)}
                      className="rounded-xl border border-zinc-700 bg-black px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                    >
                      {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <button
                      onClick={() => void revokeAccess(user.id)}
                      className="rounded-xl border border-red-900/60 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-950/40"
                    >
                      Revoke access
                    </button>
                  </div>
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
