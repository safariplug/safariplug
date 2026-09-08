"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SuggestedOffering = { name: string; description: string; durationMinutes: number; priceHint?: string };
type State = {
  account?: { contact_name: string; onboarding_status: string; completion_percent: number };
  business?: Record<string, any>;
  profile?: Record<string, any>;
  offerings?: Record<string, any>[];
  suggestedOfferings?: SuggestedOffering[];
};

export default function SupplierOnboardingPage() {
  const [state, setState] = useState<State>({});
  const [form, setForm] = useState<Record<string, any>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/supplier/onboarding", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setState(data);
      setForm({ ...data.business, ...data.profile });
    } else {
      setMessage("Please use the invitation email to access your supplier portal.");
    }
  }

  useEffect(() => { void load(); }, []);

  const set = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));

  async function createPassword() {
    setMessage("");
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : "Password created successfully.");
    if (!error) { setPassword(""); setConfirmPassword(""); void load(); }
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/supplier/onboarding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    setMessage(response.ok ? `Saved. Profile completion: ${data.completion_percent}%` : data.error || "Unable to save.");
    setSaving(false);
    void load();
  }

  async function addOffering(template?: SuggestedOffering) {
    const name = template?.name || window.prompt("Service name");
    if (!name) return;
    const price = template ? window.prompt(`Price in KES for ${name}`, "0") : window.prompt("Price in KES", "0");
    if (price === null) return;
    const duration = template ? template.durationMinutes : Number(window.prompt("Duration in minutes", "60") || 60);
    const response = await fetch("/api/supplier/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "offering", offering: { name, description: template?.description, price, duration_minutes: duration, currency: "KES" } }) });
    const data = await response.json();
    setMessage(response.ok ? `${name} saved as a draft.` : data.error || "Unable to save service.");
    void load();
  }

  async function upload(kind: string, file: File) {
    setMessage("Uploading image…");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    const response = await fetch("/api/supplier/media", { method: "POST", body: formData });
    const data = await response.json();
    setMessage(response.ok ? "Image uploaded successfully." : data.error || "Unable to upload image.");
    void load();
  }

  async function submit() {
    const response = await fetch("/api/supplier/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
    const data = await response.json();
    setMessage(response.ok ? "Submitted. SafariPlug will review your profile." : data.error || "Unable to submit.");
    void load();
  }

  if (!state.business) return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-3xl font-semibold">SafariPlug Supplier Portal</h1><p className="mt-3 text-black/60">{message || "Loading your supplier profile…"}</p></main>;

  const locked = ["approved", "live"].includes(state.account?.onboarding_status || "");
  const categoryName = state.profile?.category?.name || state.business.business_type || "Service provider";
  const suggested = state.suggestedOfferings || [];
  const existingNames = new Set((state.offerings || []).map((offering) => String(offering.name).toLowerCase()));
  const availableSuggestions = suggested.filter((offering) => !existingNames.has(offering.name.toLowerCase()));

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex items-end justify-between gap-6"><div><p className="text-sm uppercase tracking-[.2em] text-black/40">Supplier Portal</p><h1 className="mt-2 text-4xl font-semibold">Finish your SafariPlug profile</h1><p className="mt-2 text-black/60">Welcome, {state.account?.contact_name}. Complete your details, services and images.</p></div><div className="text-right"><div className="text-3xl font-semibold">{state.account?.completion_percent ?? 0}%</div><div className="text-xs text-black/50">profile complete</div></div></div>
    <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-black transition-all" style={{ width: `${state.account?.completion_percent ?? 0}%` }} /></div>

    <section className="mt-8 rounded-2xl border border-black/10 p-5"><h2 className="text-xl font-semibold">Create your password</h2><p className="mt-1 text-sm text-black/50">SafariPlug never sees or stores your password. It is managed securely by your account.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input type="password" placeholder="New password (8+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-black/15 px-3 py-2.5"/><input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-xl border border-black/15 px-3 py-2.5"/></div><button onClick={createPassword} className="mt-3 rounded-full bg-black px-5 py-2.5 text-sm text-white">Save password</button></section>

    <section className="mt-8 rounded-2xl border border-black/10 p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-black/40">Service category</p><h2 className="mt-1 text-xl font-semibold">{categoryName}</h2></div><span className="rounded-full bg-black/[.04] px-3 py-1 text-xs text-black/50">Admin assigned</span></div><p className="mt-2 text-sm text-black/50">Your service category determines the recommended services below. Add the ones you actually offer and set your own pricing.</p></section>

    <section className="mt-8 grid gap-5 md:grid-cols-2">{[["name","Business name"],["supplier_contact_name","Contact person"],["phone","Phone"],["whatsapp","WhatsApp"],["email","Email"],["address","Address"],["website_url","Website"],["instagram_url","Instagram"],["facebook_url","Facebook"],["tiktok_url","TikTok"]].map(([key,label]) => <label key={key} className="text-sm"><span className="mb-1 block font-medium">{label}</span><input disabled={locked || key === "email"} value={form[key] || ""} onChange={(event) => set(key, event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5"/></label>)}<label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Business description</span><textarea disabled={locked} value={form.description || ""} onChange={(event) => set("description", event.target.value)} rows={5} className="w-full rounded-xl border border-black/15 px-3 py-2.5"/></label><label className="text-sm"><span className="mb-1 block font-medium">Timezone</span><input disabled={locked} value={form.timezone || "Africa/Nairobi"} onChange={(event) => set("timezone", event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5"/></label><label className="text-sm"><span className="mb-1 block font-medium">Cancellation policy</span><input disabled={locked} value={form.cancellation_policy || ""} onChange={(event) => set("cancellation_policy", event.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-2.5"/></label></section>

    <section className="mt-10 rounded-2xl border border-black/10 p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Services & pricing</h2><p className="text-sm text-black/50">Recommended services for {categoryName}. Add only what you actually provide.</p></div><button onClick={() => void addOffering()} disabled={locked} className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-40">Custom service</button></div>
      {!!availableSuggestions.length && <div className="mt-5 grid gap-2 sm:grid-cols-2">{availableSuggestions.map((template) => <button key={template.name} onClick={() => void addOffering(template)} disabled={locked} className="rounded-xl border border-black/10 bg-black/[.02] p-4 text-left transition hover:border-black/25 disabled:opacity-40"><div className="flex items-start justify-between gap-3"><span className="font-medium">{template.name}</span><span className="text-lg">＋</span></div><p className="mt-1 text-xs leading-5 text-black/45">{template.description}</p><p className="mt-2 text-xs text-black/35">{template.durationMinutes} min</p></button>)}</div>}
      <div className="mt-5 space-y-2">{(state.offerings || []).map((offering) => <div key={offering.id} className="flex justify-between gap-4 rounded-xl bg-black/[.04] px-4 py-3 text-sm"><span>{offering.name}</span><span>KES {Number(offering.price).toLocaleString()} · {offering.duration_minutes} min · {offering.status}</span></div>)}{!(state.offerings || []).length && <p className="text-sm text-black/45">No services added yet.</p>}</div>
    </section>

    <section className="mt-6 rounded-2xl border border-black/10 p-5"><h2 className="text-xl font-semibold">Business images</h2><p className="mt-1 text-sm text-black/50">Upload a logo, cover image and gallery photos. Images are stored in SafariPlug’s supplier media bucket.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[["logo","Logo"],["cover","Cover image"],["gallery","Gallery photo"]].map(([kind,label]) => <label key={kind} className="cursor-pointer rounded-xl border border-dashed border-black/20 p-4 text-sm"><span className="block font-medium">{label}</span><span className="mt-1 block text-black/45">Choose image</span><input disabled={locked} type="file" accept="image/*" className="mt-3 block w-full text-xs" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(kind, file); }}/></label>)}</div></section>

    <div className="mt-6 flex flex-wrap items-center gap-3"><button onClick={save} disabled={saving || locked} className="rounded-full border border-black/15 px-5 py-2.5 text-sm disabled:opacity-40">{saving ? "Saving…" : "Save profile"}</button><button onClick={submit} disabled={locked} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-40">Submit for review</button>{state.account?.onboarding_status && <span className="text-sm text-black/50">Status: {state.account.onboarding_status}</span>}</div>{message && <p className="mt-4 text-sm">{message}</p>}
  </main>;
}
