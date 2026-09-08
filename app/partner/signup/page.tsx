"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BUSINESS_TYPES = [
  "Restaurant",
  "Hotel",
  "Barber",
  "Hair & Beauty",
  "Spa & Massage",
  "Tattoo & Body Art",
  "Nails",
  "Lashes & Brows",
  "Fitness",
  "Yoga / Pilates / Mindfulness",
  "Tour Operator",
  "Local Guide",
  "Experience Provider",
  "Event Organizer",
  "Other Service Business",
];

export default function PartnerSignupPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", business_name: "", business_type: "", password: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.full_name, account_type: "supplier" } } });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error("Unable to create account");

      const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, full_name: form.full_name, email: form.email, phone: form.phone, user_type: "partner" });
      if (profileError) throw profileError;

      const slug = form.business_name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const { data: business, error: businessError } = await supabase.from("businesses").insert({
        owner_id: user.id,
        name: form.business_name,
        slug,
        business_type: form.business_type,
        phone: form.phone,
        whatsapp: form.phone,
        email: form.email,
        status: "pending",
        verified: false,
        claimed: true,
      }).select("id").single();
      if (businessError || !business) throw businessError ?? new Error("Unable to create business");

      const { data: category, error: categoryError } = await supabase.from("service_categories").select("id").eq("name", form.business_type).eq("status", "active").maybeSingle();
      if (categoryError) throw categoryError;
      if (category) {
        const { error: serviceProfileError } = await supabase.from("service_profiles").insert({ business_id: business.id, category_id: category.id, status: "pending", booking_status: "closed" });
        if (serviceProfileError) throw serviceProfileError;
      }

      const { error: supplierError } = await supabase.from("supplier_accounts").insert({ user_id: user.id, business_id: business.id, contact_name: form.full_name, invitation_status: "accepted", onboarding_status: "invited", accepted_at: new Date().toISOString() });
      if (supplierError) throw supplierError;

      router.push("/partner/dashboard");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Signup failed");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white"><div className="mx-auto max-w-6xl px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link></div></header>
      <section className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-orange-500">Business Partner Registration</p>
          <h1 className="mt-3 text-3xl font-black">List your business on SafariPlug</h1>
          <p className="mt-3 text-slate-500">Whether you run a barber shop, spa, massage practice, tattoo studio, restaurant, hotel, tour company, wellness business or events company, SafariPlug helps customers discover and book you.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input required placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
            <input required type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
            <input required placeholder="Phone / WhatsApp number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
            <input required placeholder="Business name" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
            <select required value={form.business_type} onChange={e=>setForm({...form,business_type:e.target.value})} className="w-full rounded-xl border px-4 py-3">
              <option value="">Select business type</option>
              {BUSINESS_TYPES.map(type=><option key={type} value={type}>{type}</option>)}
            </select>
            <input required type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full rounded-xl border px-4 py-3" />
            {message && <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div>}
            <button disabled={loading} className="w-full rounded-xl bg-orange-500 py-3 font-black text-white hover:bg-orange-600 disabled:opacity-50">{loading ? "Creating account..." : "Create Business Account"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already a partner? <Link href="/partner/login" className="font-bold text-orange-500">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
