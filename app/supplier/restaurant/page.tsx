"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; description?: string | null; sort_order: number; active: boolean };
type Item = { id: string; category_id?: string | null; name: string; description?: string | null; price: number; currency: string; preparation_time_minutes?: number | null; available: boolean; active: boolean };
type Settings = { ordering_enabled: boolean; pickup_enabled: boolean; safari_driver_enabled: boolean; customer_driver_enabled: boolean; restaurant_delivery_enabled: boolean; minimum_order_amount: number; restaurant_delivery_fee: number; free_delivery_threshold: number; safari_driver_base_fee: number; safari_driver_per_km: number; customer_driver_base_fee: number; customer_driver_per_km: number; preparation_time_minutes: number };

const defaults: Settings = { ordering_enabled: true, pickup_enabled: true, safari_driver_enabled: true, customer_driver_enabled: false, restaurant_delivery_enabled: false, minimum_order_amount: 0, restaurant_delivery_fee: 0, free_delivery_threshold: 0, safari_driver_base_fee: 0, safari_driver_per_km: 0, customer_driver_base_fee: 0, customer_driver_per_km: 0, preparation_time_minutes: 30 };

export default function RestaurantSupplierPage() {
  const [businessId, setBusinessId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [categoryName, setCategoryName] = useState("");
  const [item, setItem] = useState({ name: "", description: "", price: "", categoryId: "", preparationTimeMinutes: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const onboarding = await fetch("/api/supplier/onboarding", { cache: "no-store" });
    if (!onboarding.ok) return setMessage("Please sign in through your supplier invitation first.");
    const supplier = await onboarding.json();
    const id = supplier.business?.id;
    if (!id || supplier.business?.business_type !== "Restaurant") return setMessage("This menu workspace is available to restaurant suppliers only.");
    setBusinessId(id);
    const response = await fetch(`/api/restaurants/menu?businessId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Unable to load your restaurant menu.");
    setCategories(data.categories || []); setItems(data.items || []); setSettings({ ...defaults, ...(data.settings || {}) });
  }
  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>) {
    setSaving(true); setMessage("");
    const response = await fetch("/api/restaurants/menu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setMessage(data.error || "Unable to save.");
    setMessage("Saved."); await load(); return data;
  }

  async function addCategory() {
    const name = categoryName.trim(); if (!name) return;
    await post({ action: "category", name, description: "", sortOrder: categories.length }); setCategoryName("");
  }

  async function addItem() {
    if (!item.name.trim() || item.price === "") return setMessage("Enter a menu item name and price.");
    await post({ action: "item", name: item.name.trim(), description: item.description, price: Number(item.price), currency: "KES", categoryId: item.categoryId || null, preparationTimeMinutes: item.preparationTimeMinutes ? Number(item.preparationTimeMinutes) : null, sortOrder: items.length });
    setItem({ name: "", description: "", price: "", categoryId: item.categoryId, preparationTimeMinutes: "" });
  }

  async function saveSettings() { await post({ action: "settings", settings }); }

  if (!businessId) return <main className="mx-auto max-w-4xl px-6 py-16"><h1 className="text-3xl font-semibold">Restaurant menu & ordering</h1><p className="mt-3 text-black/60">{message || "Loading your restaurant workspace…"}</p></main>;

  const toggles: Array<[keyof Settings, string]> = [["ordering_enabled", "Accept SafariPlug orders"], ["pickup_enabled", "Offer customer pickup"], ["safari_driver_enabled", "Offer SafariPlug driver delivery"], ["customer_driver_enabled", "Allow customer-arranged driver delivery"], ["restaurant_delivery_enabled", "Offer restaurant delivery"]];

  return <main className="mx-auto max-w-4xl px-6 py-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[.2em] text-black/40">Restaurant supplier</p><h1 className="mt-2 text-4xl font-semibold">Menu & ordering</h1><p className="mt-2 text-black/60">Build the menu customers will see and control how SafariPlug handles pickup and delivery.</p></div><div className="flex gap-2 text-sm"><Link href="/supplier/onboarding" className="rounded-full border border-black/15 px-4 py-2">Business profile</Link><Link href="/supplier/restaurant-orders" className="rounded-full bg-black px-4 py-2 text-white">Manage orders</Link></div></div>
    <section className="mt-8 rounded-2xl border border-black/10 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Ordering settings</h2><p className="mt-1 text-sm text-black/50">Choose the fulfillment methods your restaurant can reliably support.</p></div><span className={`rounded-full px-3 py-1 text-xs ${settings.ordering_enabled ? "bg-green-500/10 text-green-700" : "bg-black/5 text-black/50"}`}>{settings.ordering_enabled ? "Ordering live" : "Ordering paused"}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{toggles.map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-xl bg-black/[.03] p-3 text-sm"><input type="checkbox" checked={Boolean(settings[key])} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} />{label}</label>)}<label className="text-sm"><span className="mb-1 block">Minimum order (KES)</span><input type="number" min="0" value={settings.minimum_order_amount} onChange={(e) => setSettings((s) => ({ ...s, minimum_order_amount: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">Restaurant delivery fee (KES)</span><input type="number" min="0" value={settings.restaurant_delivery_fee} onChange={(e) => setSettings((s) => ({ ...s, restaurant_delivery_fee: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">Free delivery above (KES)</span><input type="number" min="0" value={settings.free_delivery_threshold} onChange={(e) => setSettings((s) => ({ ...s, free_delivery_threshold: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">Typical preparation time (minutes)</span><input type="number" min="1" value={settings.preparation_time_minutes} onChange={(e) => setSettings((s) => ({ ...s, preparation_time_minutes: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label></div><div className="mt-5 border-t border-black/10 pt-5"><h3 className="font-medium">Driver pricing</h3><div className="mt-3 grid gap-3 md:grid-cols-4"><label className="text-sm"><span className="mb-1 block">SafariPlug base (KES)</span><input type="number" min="0" value={settings.safari_driver_base_fee} onChange={(e) => setSettings((s) => ({ ...s, safari_driver_base_fee: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">SafariPlug / km</span><input type="number" min="0" value={settings.safari_driver_per_km} onChange={(e) => setSettings((s) => ({ ...s, safari_driver_per_km: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">Customer driver base (KES)</span><input type="number" min="0" value={settings.customer_driver_base_fee} onChange={(e) => setSettings((s) => ({ ...s, customer_driver_base_fee: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label><label className="text-sm"><span className="mb-1 block">Customer driver / km</span><input type="number" min="0" value={settings.customer_driver_per_km} onChange={(e) => setSettings((s) => ({ ...s, customer_driver_per_km: Number(e.target.value) }))} className="w-full rounded-xl border border-black/15 px-3 py-2.5" /></label></div></div><button disabled={saving} onClick={() => void saveSettings()} className="mt-5 rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-40">Save ordering settings</button></section>
    <section className="mt-6 rounded-2xl border border-black/10 p-5"><h2 className="text-xl font-semibold">Menu categories</h2><div className="mt-4 flex gap-2"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Breakfast, Main Courses, Drinks" className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2.5" /><button disabled={saving} onClick={() => void addCategory()} className="rounded-full bg-black px-4 py-2.5 text-sm text-white disabled:opacity-40">Add category</button></div><div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <span key={category.id} className="rounded-full bg-black/[.05] px-3 py-1.5 text-sm">{category.name}</span>)}</div></section>
    <section className="mt-6 rounded-2xl border border-black/10 p-5"><h2 className="text-xl font-semibold">Add menu item</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><input placeholder="Item name" value={item.name} onChange={(e) => setItem((v) => ({ ...v, name: e.target.value }))} className="rounded-xl border border-black/15 px-3 py-2.5" /><input type="number" min="0" placeholder="Price in KES" value={item.price} onChange={(e) => setItem((v) => ({ ...v, price: e.target.value }))} className="rounded-xl border border-black/15 px-3 py-2.5" /><textarea placeholder="Description" value={item.description} onChange={(e) => setItem((v) => ({ ...v, description: e.target.value }))} rows={3} className="rounded-xl border border-black/15 px-3 py-2.5" /><div className="grid gap-3"><select value={item.categoryId} onChange={(e) => setItem((v) => ({ ...v, categoryId: e.target.value }))} className="rounded-xl border border-black/15 px-3 py-2.5"><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input type="number" min="1" placeholder="Preparation time (minutes, optional)" value={item.preparationTimeMinutes} onChange={(e) => setItem((v) => ({ ...v, preparationTimeMinutes: e.target.value }))} className="rounded-xl border border-black/15 px-3 py-2.5" /></div></div><button disabled={saving} onClick={() => void addItem()} className="mt-4 rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-40">Add menu item</button></section>
    <section className="mt-6 rounded-2xl border border-black/10 p-5"><h2 className="text-xl font-semibold">Current menu</h2><div className="mt-4 space-y-2">{items.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl bg-black/[.04] px-4 py-3 text-sm"><div><div className="font-medium">{entry.name}</div><div className="mt-1 text-xs text-black/50">{entry.description || "No description"}{entry.preparation_time_minutes ? ` · ${entry.preparation_time_minutes} min` : ""}</div></div><div className="text-right"><div className="font-medium">{entry.currency} {Number(entry.price).toLocaleString()}</div><div className="text-xs text-black/45">{entry.available ? "Available" : "Unavailable"}</div></div></div>)}{!items.length && <p className="text-sm text-black/45">No menu items yet. Add your first item above.</p>}</div></section>
    {message && <p className="mt-5 text-sm text-black/60">{message}</p>}
  </main>;
}
