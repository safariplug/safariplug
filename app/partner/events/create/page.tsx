"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type City = { id: string; name: string; country: string | null };

const CATEGORIES = ["Adventure", "Beach", "Culture", "Food & Drink", "Music & Nightlife", "Safari", "Wellness", "Family", "Other"];

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [message, setMessage] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", category: "", city_id: "", venue_name: "", venue_address: "",
    start_at: "", end_at: "", price: "", currency: "KES", booking_url: "", organizer_name: "",
    organizer_contact: "", image_url: "",
  });

  useEffect(() => {
    async function loadCities() {
      const { data } = await supabase.from("cities").select("id,name,country").order("name");
      setCities(data || []);
      setLoadingCities(false);
    }
    loadCities();
  }, []);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please login first.");
      if (!form.title.trim() || !form.description.trim() || !form.category || !form.city_id || !form.start_at) {
        throw new Error("Please complete the title, description, category, city and start date.");
      }
      if (form.end_at && new Date(form.end_at) <= new Date(form.start_at)) {
        throw new Error("End time must be after the start time.");
      }
      if (form.price && Number(form.price) < 0) throw new Error("Price cannot be negative.");
      if (form.booking_url && !/^https:\/\//i.test(form.booking_url)) throw new Error("Booking URL must start with https://");
      if (form.image_url && !/^https:\/\//i.test(form.image_url)) throw new Error("Image URL must start with https://");

      const { error } = await supabase.from("events").insert({
        title: form.title.trim(), description: form.description.trim(), category: form.category,
        city_id: form.city_id, venue_name: form.venue_name.trim() || null, venue_address: form.venue_address.trim() || null,
        start_at: new Date(form.start_at).toISOString(), end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        price: form.price ? Number(form.price) : null, currency: form.currency.toUpperCase(),
        booking_url: form.booking_url.trim() || null, organizer_name: form.organizer_name.trim() || null,
        organizer_contact: form.organizer_contact.trim() || null, image_url: form.image_url.trim() || null,
        submitted_by: user.id, status: "pending",
      });
      if (error) throw error;

      setMessage("Experience submitted successfully. SafariPlug will review it before publication.");
      setTimeout(() => router.push("/partner/dashboard"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to submit experience.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Safari<span className="text-orange-500">Plug</span></Link>
          <Link href="/partner/dashboard" className="text-sm font-bold text-slate-500 hover:text-slate-900">Partner dashboard</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-widest text-orange-500">Partner Portal</p>
          <h1 className="mt-3 text-3xl font-black">Submit a New Experience</h1>
          <p className="mt-3 text-slate-500">Tell travelers what makes your experience worth discovering. SafariPlug reviews every submission before it appears publicly.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold">Experience title *</label>
              <input required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Sunset Dhow Cruise" className={inputClass} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">Description *</label>
              <textarea required value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Describe what travelers will experience..." className={`${inputClass} min-h-32`} />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold">Category *</label>
                <select required value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold">City *</label>
                <select required value={form.city_id} onChange={(e) => update("city_id", e.target.value)} className={inputClass} disabled={loadingCities}>
                  <option value="">{loadingCities ? "Loading cities..." : "Select city"}</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name}{city.country ? `, ${city.country}` : ""}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-bold">Venue</label><input value={form.venue_name} onChange={(e) => update("venue_name", e.target.value)} placeholder="Venue or meeting point" className={inputClass} /></div>
              <div><label className="mb-2 block text-sm font-bold">Venue address</label><input value={form.venue_address} onChange={(e) => update("venue_address", e.target.value)} placeholder="Address" className={inputClass} /></div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-bold">Start date & time *</label><input required type="datetime-local" value={form.start_at} onChange={(e) => update("start_at", e.target.value)} className={inputClass} /></div>
              <div><label className="mb-2 block text-sm font-bold">End date & time</label><input type="datetime-local" value={form.end_at} onChange={(e) => update("end_at", e.target.value)} className={inputClass} /></div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-sm font-bold">Price</label><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="0 for free" className={inputClass} /></div>
              <div><label className="mb-2 block text-sm font-bold">Currency</label><select value={form.currency} onChange={(e) => update("currency", e.target.value)} className={inputClass}><option>KES</option><option>USD</option><option>TZS</option><option>UGX</option></select></div>
            </div>

            <div className="border-t pt-5">
              <p className="font-bold">Booking & contact</p>
              <div className="mt-4 space-y-4">
                <input value={form.booking_url} onChange={(e) => update("booking_url", e.target.value)} placeholder="Booking URL (https://...)" className={inputClass} />
                <div className="grid gap-5 sm:grid-cols-2"><input value={form.organizer_name} onChange={(e) => update("organizer_name", e.target.value)} placeholder="Organizer / business name" className={inputClass} /><input value={form.organizer_contact} onChange={(e) => update("organizer_contact", e.target.value)} placeholder="WhatsApp / phone" className={inputClass} /></div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">Image URL</label>
              <input value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="https://..." className={inputClass} />
              <p className="mt-2 text-xs text-slate-400">Use a direct HTTPS image URL. A strong landscape photo helps travelers evaluate the listing.</p>
            </div>

            {message && <div className={`rounded-xl p-4 text-sm font-bold ${message.includes("successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message}</div>}

            <button type="submit" disabled={loading || loadingCities} className="w-full rounded-xl bg-orange-500 py-4 font-black text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Submitting..." : "Submit for Review"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
