"use client";

import { useEffect, useMemo, useState } from "react";

type Item = { id: string; name: string; description?: string | null; image_url?: string | null; price: number; currency: string; preparation_time_minutes?: number | null };
type Category = { id: string; name: string; description?: string | null; items: Item[] };
type Settings = { ordering_enabled: boolean; pickup_enabled: boolean; safari_driver_enabled: boolean; customer_driver_enabled: boolean; restaurant_delivery_enabled: boolean; restaurant_delivery_fee: number; free_delivery_threshold: number | null; minimum_order_amount: number; preparation_time_minutes: number };
type CartLine = { item: Item; quantity: number; notes: string };

export default function RestaurantOrdering({ businessId }: { businessId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("pickup");
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/restaurants/${businessId}/menu`).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Unable to load menu");
      setSettings(data.settings);
      setCategories(data.categories || []);
      if (data.settings?.pickup_enabled) setMethod("pickup");
      else if (data.settings?.restaurant_delivery_enabled) setMethod("restaurant_delivery");
      else if (data.settings?.safari_driver_enabled) setMethod("safari_driver");
      else if (data.settings?.customer_driver_enabled) setMethod("customer_driver");
    }).catch((e) => setMessage(e.message)).finally(() => setLoading(false));
  }, [businessId]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0), [cart]);
  const deliveryFee = method === "restaurant_delivery" && settings ? (settings.free_delivery_threshold != null && subtotal >= Number(settings.free_delivery_threshold) ? 0 : Number(settings.restaurant_delivery_fee || 0)) : 0;
  const total = subtotal + deliveryFee;

  function add(item: Item) { setCart((current) => { const found = current.find((x) => x.item.id === item.id); return found ? current.map((x) => x.item.id === item.id ? { ...x, quantity: x.quantity + 1 } : x) : [...current, { item, quantity: 1, notes: "" }]; }); }
  function change(id: string, delta: number) { setCart((current) => current.flatMap((x) => x.item.id === id ? (x.quantity + delta > 0 ? [{ ...x, quantity: x.quantity + delta }] : []) : [x])); }

  async function checkout() {
    setMessage("");
    if (!customer.name || !customer.phone || !cart.length) return setMessage("Add your name, phone number and at least one item.");
    if (method !== "pickup" && !customer.address) return setMessage("Add a delivery address.");
    setOrdering(true);
    try {
      const res = await fetch("/api/restaurants/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, fulfillmentMethod: method, customerName: customer.name, customerPhone: customer.phone, customerEmail: customer.email || undefined, deliveryAddress: customer.address || undefined, customerNotes: customer.notes || undefined, items: cart.map((x) => ({ menuItemId: x.item.id, quantity: x.quantity, notes: x.notes || undefined })) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to place order");
      setCart([]);
      setMessage(`Order ${data.order.public_id || data.order.id} received. Payment is the next step.`);
    } catch (e: any) { setMessage(e.message); } finally { setOrdering(false); }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-6 py-16">Loading menu…</main>;
  if (!settings?.ordering_enabled) return <main className="mx-auto max-w-6xl px-6 py-16"><h1 className="text-3xl font-semibold">Ordering is unavailable</h1><p className="mt-2 text-slate-600">This restaurant is not accepting online orders right now.</p></main>;

  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">SafariPlug Dining</p>
        <h1 className="mt-2 text-4xl font-semibold">Order from this restaurant</h1>
        <p className="mt-2 text-slate-600">Fresh menu, clear delivery choices, and one simple checkout.</p>
        <div className="mt-8 space-y-8">
          {categories.map((category) => <div key={category.id}><h2 className="text-2xl font-semibold">{category.name}</h2><div className="mt-3 divide-y rounded-2xl border">{category.items.map((item) => <div key={item.id} className="flex gap-4 p-4"><div className="min-w-0 flex-1"><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-slate-500">{item.description}</p><p className="mt-2 font-medium">{item.currency} {Number(item.price).toLocaleString()}</p></div><button onClick={() => add(item)} className="self-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Add</button></div>)}</div></div>)}
        </div>
      </section>
      <aside className="h-fit rounded-3xl border bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <h2 className="text-xl font-semibold">Your order</h2>
        {!cart.length ? <p className="py-8 text-sm text-slate-500">Your cart is empty.</p> : <div className="mt-4 space-y-3">{cart.map((line) => <div key={line.item.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{line.item.name}</p><p className="text-sm text-slate-500">{line.item.currency} {Number(line.item.price).toLocaleString()}</p></div><button onClick={() => change(line.item.id, -1)} className="h-8 w-8 rounded-full border">−</button><span>{line.quantity}</span><button onClick={() => change(line.item.id, 1)} className="h-8 w-8 rounded-full border">+</button></div>)}</div>}
        <div className="mt-5 space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{cart[0]?.item.currency || "KES"} {subtotal.toLocaleString()}</span></div><div className="flex justify-between"><span>Delivery</span><span>{deliveryFee ? `${cart[0]?.item.currency || "KES"} ${deliveryFee.toLocaleString()}` : "Free"}</span></div><div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{cart[0]?.item.currency || "KES"} {total.toLocaleString()}</span></div></div>
        <div className="mt-5"><p className="text-sm font-semibold">Fulfilment</p><div className="mt-2 grid gap-2">{[["pickup", "Pickup"], ["restaurant_delivery", "Restaurant delivery"], ["safari_driver", "SafariPlug driver"], ["customer_driver", "My chosen driver"]].filter(([key]) => settings[`${key === "pickup" ? "pickup" : key}_enabled` as keyof Settings]).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"><input type="radio" checked={method === key} onChange={() => setMethod(key)} />{label}</label>)}</div></div>
        <div className="mt-5 space-y-2"><input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Full name" className="w-full rounded-xl border px-3 py-2" /><input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone / WhatsApp" className="w-full rounded-xl border px-3 py-2" /><input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email (optional)" className="w-full rounded-xl border px-3 py-2" />{method !== "pickup" && <textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Delivery address" className="min-h-20 w-full rounded-xl border px-3 py-2" />}<textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} placeholder="Order notes (optional)" className="min-h-16 w-full rounded-xl border px-3 py-2" /></div>
        {message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm">{message}</p>}
        <button disabled={ordering || !cart.length} onClick={checkout} className="mt-4 w-full rounded-full bg-black px-4 py-3 font-semibold text-white disabled:opacity-40">{ordering ? "Placing order…" : "Place order"}</button>
        <p className="mt-3 text-xs text-slate-500">Payment checkout will be connected to SafariPlug M-Pesa after order creation.</p>
      </aside>
    </div>
  </main>;
}
