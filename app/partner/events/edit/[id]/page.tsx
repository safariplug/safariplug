"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type City = { id: string; name: string; country: string | null };
const CATEGORIES = ["Adventure", "Beach", "Culture", "Food & Drink", "Music & Nightlife", "Safari", "Wellness", "Family", "Other"];
const MAX_DESCRIPTION = 5000;

type FormState = { title: string; description: string; category: string; city_id: string; venue_name: string; venue_address: string; start_at: string; end_at: string; price: string; currency: string; booking_url: string; organizer_name: string; organizer_contact: string; image_url: string };
const emptyForm: FormState = { title: "", description: "", category: "", city_id: "", venue_name: "", venue_address: "", start_at: "", end_at: "", price: "", currency: "KES", booking_url: "", organizer_name: "", organizer_contact: "", image_url: "" };

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditPartnerEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [{ data: { user } }, { data: cityData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from("cities").select("id,name,country").order("name"),
        ]);
        if (!user) throw new Error("Please login first.");
        setCities(cityData || []);
        const { data: event, error } = await supabase.from("events").select("id,title,description,category,city_id,venue_name,venue_address,start_at,end_at,price,currency,booking_url,organizer_name,organizer_contact,image_url,status").eq("id", id).eq("submitted_by", user.id).maybeSingle();
        if (error) throw error;
        if (!event) throw new Error("Experience not found or you do not have access to it.");
        if (event.status !== "rejected") throw new Error("Only rejected experiences can be edited and resubmitted.");
        setForm({ title: event.title || "", description: event.description || "", category: event.category || "", city_id: event.city_id || "", venue_name: event.venue_name || "", venue_address: event.venue_address || "", start_at: localDateTime(event.start_at), end_at: localDateTime(event.end_at), price: event.price == null ? "" : String(event.price), currency: event.currency || "KES", booking_url: event.booking_url || "", organizer_name: event.organizer_name || "", organizer_contact: event.organizer_contact || "", image_url: event.image_url || "" });
      } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to load experience."); }
      finally { setLoading(false); }
    }
    if (id) load();
  }, [id]);

  function update(key: keyof FormState, value: string) { setForm(current => ({ ...current, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login first.");
      const title = form.title.trim();
      const description = form.description.trim();
      if (!title || !description || !form.category || !form.city_id || !form.start_at) throw new Error("Please complete the title, description, category, city and start date.");
      if (title.length < 4 || title.length > 160) throw new Error("Experience title must be between 4 and 160 characters.");
      if (description.length < 30) throw new Error("Please provide at least 30 characters describing the experience.");
      if (description.length > MAX_DESCRIPTION) throw new Error(`Description must be ${MAX_DESCRIPTION} characters or fewer.`);
      const start = new Date(form.start_at); const end = form.end_at ? new Date(form.end_at) : null;
      if (Number.isNaN(start.getTime())) throw new Error("Please enter a valid start date and time.");
      if (end && (Number.isNaN(end.getTime()) || end <= start)) throw new Error("End time must be after the start time.");
      if (form.price && (!Number.isFinite(Number(form.price)) || Number(form.price) < 0)) throw new Error("Price must be zero or greater.");
      for (const [label, value] of [["Booking URL", form.booking_url], ["Image URL", form.image_url]] as const) if (value && !/^https:\/\//i.test(value.trim())) throw new Error(`${label} must start with https://`);
      const { error } = await supabase.from("events").update({ title, description, category: form.category, city_id: form.city_id, venue_name: form.venue_name.trim() || null, venue_address: form.venue_address.trim() || null, start_at: start.toISOString(), end_at: end ? end.toISOString() : null, price: form.price ? Number(form.price) : null, currency: form.currency.toUpperCase(), booking_url: form.booking_url.trim() || null, organizer_name: form.organizer_name.trim() || null, organizer_contact: form.organizer_contact.trim() || null, image_url: form.image_url.trim() || null, status: "pending", featured: false }).eq("id", id).eq("submitted_by", user.id).eq("status", "rejected");
      if (error) throw error;
      setMessage("Updated successfully. Your experience has been resubmitted for review.");
      setTimeout(() => router.push("/partner/events"), 1200);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Unable to update experience."); }
    finally { setSaving(false); }
  }

  const inputClass = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500";
  if (loading) return <main className="min-h-screen bg-slate-100 p-8 text-slate-900"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center">Loading experience...</div></main>;
  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link><Link href="/partner/events" className="text-sm font-bold text-slate-500 hover:text-slate-900">My experiences</Link></div></header>
    <section className="mx-auto max-w-3xl px-6 py-10"><div className="rounded-3xl bg-white p-8 shadow-sm">
      <p className="text-sm font-black uppercase tracking-widest text-red-500">Changes requested</p><h1 className="mt-3 text-3xl font-black">Fix & Resubmit Experience</h1><p className="mt-3 text-slate-500">Update the details that need attention, then resubmit your experience for SafariPlug review.</p>
      {message && <div aria-live="polite" className={`mt-6 rounded-xl p-4 text-sm font-bold ${message.includes("resubmitted") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div><label className="mb-2 block text-sm font-bold">Experience title *</label><input required maxLength={160} value={form.title} onChange={e => update("title", e.target.value)} className={inputClass} /></div>
        <div><label className="mb-2 block text-sm font-bold">Description *</label><textarea required maxLength={MAX_DESCRIPTION} value={form.description} onChange={e => update("description", e.target.value)} className={`${inputClass} min-h-32`} /><p className="mt-1 text-right text-xs text-slate-400">{form.description.length}/{MAX_DESCRIPTION}</p></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-bold">Category *</label><select required value={form.category} onChange={e => update("category", e.target.value)} className={inputClass}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></div><div><label className="mb-2 block text-sm font-bold">City *</label><select required value={form.city_id} onChange={e => update("city_id", e.target.value)} className={inputClass}><option value="">Select city</option>{cities.map(city => <option key={city.id} value={city.id}>{city.name}{city.country ? `, ${city.country}` : ""}</option>)}</select></div></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-bold">Venue</label><input maxLength={200} value={form.venue_name} onChange={e => update("venue_name", e.target.value)} className={inputClass} /></div><div><label className="mb-2 block text-sm font-bold">Venue address</label><input maxLength={300} value={form.venue_address} onChange={e => update("venue_address", e.target.value)} className={inputClass} /></div></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-bold">Start date & time *</label><input required type="datetime-local" value={form.start_at} onChange={e => update("start_at", e.target.value)} className={inputClass} /></div><div><label className="mb-2 block text-sm font-bold">End date & time</label><input type="datetime-local" value={form.end_at} onChange={e => update("end_at", e.target.value)} className={inputClass} /></div></div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-bold">Price</label><input type="number" min="0" step="0.01" value={form.price} onChange={e => update("price", e.target.value)} className={inputClass} /></div><div><label className="mb-2 block text-sm font-bold">Currency</label><select value={form.currency} onChange={e => update("currency", e.target.value)} className={inputClass}><option>KES</option><option>USD</option><option>TZS</option><option>UGX</option></select></div></div>
        <div className="border-t pt-5"><p className="font-bold">Booking & contact</p><div className="mt-4 space-y-4"><input maxLength={500} value={form.booking_url} onChange={e => update("booking_url", e.target.value)} placeholder="Booking URL (https://...)" className={inputClass} /><div className="grid gap-5 sm:grid-cols-2"><input maxLength={160} value={form.organizer_name} onChange={e => update("organizer_name", e.target.value)} placeholder="Organizer / business name" className={inputClass} /><input maxLength={80} value={form.organizer_contact} onChange={e => update("organizer_contact", e.target.value)} placeholder="WhatsApp / phone" className={inputClass} /></div></div></div>
        <div><label className="mb-2 block text-sm font-bold">Image URL</label><input maxLength={500} value={form.image_url} onChange={e => update("image_url", e.target.value)} placeholder="https://..." className={inputClass} /></div>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-orange-500 py-4 font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Resubmitting..." : "Fix & Resubmit for Review"}</button>
      </form>
    </div></section>
  </main>;
}
