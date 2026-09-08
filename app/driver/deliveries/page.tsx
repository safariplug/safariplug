"use client";

import { useEffect, useState } from "react";

const labels: Record<string, string> = {
  assigned: "New delivery",
  accepted: "Accepted",
  arrived_at_restaurant: "At restaurant",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
  declined: "Declined",
  cancelled: "Cancelled",
};

const nextAction: Record<string, { value: string; label: string }> = {
  assigned: { value: "accepted", label: "Accept delivery" },
  accepted: { value: "arrived_at_restaurant", label: "I've arrived" },
  arrived_at_restaurant: { value: "picked_up", label: "Confirm pickup" },
  picked_up: { value: "on_the_way", label: "Start delivery" },
  on_the_way: { value: "delivered", label: "Mark delivered" },
};

type Item = { item_name: string; quantity: number; line_total: number };
type Order = { id: string; public_id?: string | null; status: string; payment_status: string; fulfillment_method: string; currency: string; customer_total: number; delivery_address?: string | null; delivery_lat?: number | null; delivery_lng?: number | null; notes?: string | null; food_order_items?: Item[]; businesses?: { name?: string | null } | null };
type Assignment = { id: string; status: string; delivery_fee?: number | null; assignment_source?: string | null };
type Delivery = { assignment: Assignment; order: Order | null };

export default function DriverDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [message, setMessage] = useState("Loading deliveries…");
  const [busy, setBusy] = useState("");

  async function load() {
    const r = await fetch("/api/restaurants/deliveries", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) { setMessage(d.error || "Unable to load deliveries."); return; }
    setDeliveries(d.deliveries || []);
    setMessage("");
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function advance(delivery: Delivery) {
    const action = nextAction[delivery.assignment.status];
    if (!action || !delivery.order) return;
    setBusy(delivery.assignment.id);
    try {
      const assignmentStatuses = ["accepted", "arrived_at_restaurant", "picked_up"];
      const body = assignmentStatuses.includes(action.value)
        ? { orderId: delivery.order.id, assignmentStatus: action.value }
        : { orderId: delivery.order.id, assignmentStatus: action.value, status: action.value };
      const r = await fetch("/api/restaurants/orders/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to update delivery.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to update delivery."); }
    finally { setBusy(""); }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-4xl">
    <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">SafariPlug Driver</p>
    <h1 className="mt-2 text-4xl font-semibold">Deliveries</h1>
    <p className="mt-2 text-slate-600">Accept food deliveries, collect the order, and complete the drop-off.</p>
    {message && <p className="mt-6 rounded-2xl bg-white p-4 text-sm text-slate-600">{message}</p>}
    <div className="mt-8 space-y-5">{deliveries.map((d) => {
      const o = d.order; if (!o) return null;
      const action = nextAction[d.assignment.status];
      return <article key={d.assignment.id} className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold">{o.businesses?.name || "Restaurant"}</p><h2 className="mt-1 text-xl font-semibold">Order {o.public_id || o.id}</h2><p className="mt-1 text-sm text-slate-500">{labels[d.assignment.status] || d.assignment.status}</p></div>
          <div className="text-right"><p className="font-semibold">{o.currency} {Number(o.customer_total).toLocaleString()}</p>{d.assignment.delivery_fee != null && <p className="mt-1 text-xs text-slate-500">Delivery fee {o.currency} {Number(d.assignment.delivery_fee).toLocaleString()}</p>}</div>
        </div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Drop-off</p><p className="mt-2 font-medium">{o.delivery_address || "Address supplied with order"}</p>{o.delivery_lat != null && o.delivery_lng != null && <a className="mt-2 inline-block text-sm font-semibold underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${o.delivery_lat},${o.delivery_lng}`}>Open in Maps</a>}</div>
        {o.notes && <p className="mt-4 rounded-xl border p-3 text-sm text-slate-600">Note: {o.notes}</p>}
        <div className="mt-5 space-y-2 border-t pt-4">{(o.food_order_items || []).map((i, n) => <div key={n} className="flex justify-between text-sm"><span>{i.quantity} × {i.item_name}</span><span>{o.currency} {Number(i.line_total).toLocaleString()}</span></div>)}</div>
        <div className="mt-5 flex flex-wrap gap-3">{action && <button disabled={busy === d.assignment.id} onClick={() => advance(d)} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === d.assignment.id ? "Updating…" : action.label}</button>}{["assigned"].includes(d.assignment.status) && <button disabled={busy === d.assignment.id} onClick={async () => { setBusy(d.assignment.id); try { const r = await fetch("/api/restaurants/orders/status", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({orderId:o.id,assignmentStatus:"declined"}) }); const x=await r.json(); if(!r.ok) throw new Error(x.error||"Unable to decline"); await load(); } catch(e) { setMessage(e instanceof Error ? e.message : "Unable to decline"); } finally { setBusy(""); } }} className="rounded-full border px-5 py-3 text-sm font-semibold disabled:opacity-50">Decline</button>}</div>
      </article>;
    })}{!deliveries.length && !message && <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">No active deliveries right now.</div>}</div>
  </div></main>;
}
