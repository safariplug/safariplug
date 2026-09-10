"use client";

import { useState } from "react";
import Link from "next/link";

const BUSINESS_TYPES = [
  "Restaurant", "Hotel", "Barber", "Hair & Beauty", "Spa & Massage", "Tattoo & Body Art", "Nails", "Lashes & Brows", "Fitness", "Yoga / Pilates / Mindfulness", "Tour Operator", "Local Guide", "Experience Provider", "Event Organizer", "Other Service Business",
];

export default function PartnerSignupPage() {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", business_name: "", business_type: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage(""); setSuccess(false);
    try {
      const response = await fetch("/api/partner/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Signup failed.");
      setSuccess(true); setMessage(data.message || "Account created. Check your email to confirm your address.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Signup failed."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link><Link href="/partner/login" className="text-sm font-bold text-slate-500">Partner sign in</Link></div></header>
      <section className="mx-auto max-w-xl px-6 py-12"><div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-500">Business Partner Registration</p>
        <h1 className="mt-3 text-3xl font-black">List your business on SafariPlug</h1>
        <p className="mt-3 text-slate-500">Whether you run a barber shop, spa, massage practice, tattoo studio, restaurant, hotel, tour company, wellness business or events company, SafariPlug helps customers discover and book you.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input required placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
          <input required type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
          <input required placeholder="Phone / WhatsApp number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
          <input required placeholder="Business name" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
          <select required value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} className="w-full rounded-xl border px-4 py-3"><option value="">Select business type</option>{BUSINESS_TYPES.map(type=><option key={type} value={type}>{type}</option>)}</select>
          <input required type="password" minLength={8} placeholder="Password (8+ characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
          {message && <div className={`rounded-xl p-3 text-sm font-bold ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
          <button disabled={loading || success} className="w-full rounded-xl bg-orange-500 py-3 font-black text-white hover:bg-orange-600 disabled:opacity-50">{loading ? "Creating account..." : success ? "Check your email" : "Create Business Account"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already a partner? <Link href="/partner/login" className="font-bold text-orange-500">Sign in</Link></p>
      </div></section>
    </main>
  );
}
