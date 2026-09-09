"use client";

import { useEffect, useState } from "react";

type Value = { id: string; name: string; price_delta: number; sort_order: number; active: boolean };
type Option = { id: string; name: string; required: boolean; sort_order: number; active: boolean; restaurant_menu_item_option_values?: Value[] };
type Item = { id: string; category_id: string | null; name: string; description: string | null; price: number; currency: string; available: boolean; active: boolean; preparation_time_minutes: number | null; restaurant_menu_item_options?: Option[] };
type Category = { id: string; name: string; description: string | null; sort_order: number; active: boolean };

const boolSettings = [
  ["ordering_enabled", "Online ordering"],
  ["pickup_enabled", "Pickup"],
  ["restaurant_delivery_enabled", "Restaurant delivery"],
  ["safari_driver_enabled", "SafariPlug delivery"],
  ["customer_driver_enabled", "Customer-selected driver"],
] as const;

export default function MenuManager({ businessId }: { businessId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [newCategory, setNewCategory] = useState("");
  const [newItem, setNewItem] = useState({ name: "", price: "", categoryId: "" });
  const [newOption, setNewOption] = useState<Record<string, string>>({});
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/restaurants/menu?businessId=${encodeURIComponent(businessId)}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) return setMessage(d.error || "Unable to load menu");
    setSettings(d.settings || {}); setCategories(d.categories || []); setItems(d.items || []); setMessage("");
  }
  useEffect(() => { void load(); }, [businessId]);

  async function post(body: any) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/restaurants/menu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to save menu"); await load();
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function patch(body: any) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/restaurants/menu", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Unable to update menu"); await load();
    } catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-8"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">SafariPlug Restaurant Operations</p><h1 className="mt-2 text-4xl font-semibold">Menu & ordering</h1><p className="mt-2 text-slate-600">Manage what customers see, what they can customize, and how orders are fulfilled.</p></div><button disabled={busy} onClick={() => void load()} className="rounded-full border bg-white px-4 py-2 text-sm font-semibold">Refresh</button></div>
    {message && <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}

    <section className="mt-8 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Ordering controls</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{boolSettings.map(([key,label]) => <label key={key} className="flex items-center gap-3 rounded-2xl border p-3 text-sm"><input type="checkbox" checked={settings[key] === true} onChange={e => { const value=e.target.checked; setSettings(s=>({...s,[key]:value})); void post({ action:"settings", settings:{ [key]: value } }); }} />{label}</label>)}</div></section>

    <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Categories</h2><div className="mt-4 flex flex-wrap gap-2"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="e.g. Main dishes" className="rounded-full border px-4 py-2 text-sm" /><button disabled={!newCategory.trim()||busy} onClick={()=>{void post({action:"category",name:newCategory,sortOrder:categories.length});setNewCategory("")}} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Add category</button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{categories.map(c=><div key={c.id} className="flex items-center justify-between rounded-2xl border p-4"><div><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.active?"Visible":"Hidden"}</p></div><button disabled={busy} onClick={()=>void patch({type:"category",id:c.id,name:c.name,description:c.description||"",sortOrder:c.sort_order,active:!c.active})} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{c.active?"Hide":"Show"}</button></div>)}</div></section>

    <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Menu items</h2><div className="flex flex-wrap gap-2"><input value={newItem.name} onChange={e=>setNewItem(v=>({...v,name:e.target.value}))} placeholder="Dish name" className="w-40 rounded-full border px-4 py-2 text-sm" /><input value={newItem.price} onChange={e=>setNewItem(v=>({...v,price:e.target.value}))} placeholder="Price" inputMode="decimal" className="w-28 rounded-full border px-4 py-2 text-sm" /><select value={newItem.categoryId} onChange={e=>setNewItem(v=>({...v,categoryId:e.target.value}))} className="rounded-full border bg-white px-4 py-2 text-sm"><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button disabled={!newItem.name.trim()||!newItem.price||busy} onClick={()=>{void post({action:"item",name:newItem.name,price:Number(newItem.price),currency:settings.currency||"KES",categoryId:newItem.categoryId||null,sortOrder:items.length});setNewItem({name:"",price:"",categoryId:""})}} className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">Add item</button></div></div>
      <div className="mt-6 space-y-4">{items.map(item=><article key={item.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.name}</p><p className="text-sm text-slate-500">{item.currency} {Number(item.price).toLocaleString()} · {item.available?"Available":"Unavailable"} · {item.active?"Active":"Hidden"}</p></div><div className="flex gap-2"><button disabled={busy} onClick={()=>void patch({type:"item",id:item.id,available:!item.available})} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{item.available?"Mark unavailable":"Mark available"}</button><button disabled={busy} onClick={()=>void patch({type:"item",id:item.id,active:!item.active})} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{item.active?"Hide":"Show"}</button></div></div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Customizations</p><p className="text-xs text-slate-500">Required choices, add-ons and price adjustments.</p></div><div className="flex gap-2"><input value={newOption[item.id]||""} onChange={e=>setNewOption(v=>({...v,[item.id]:e.target.value}))} placeholder="e.g. Size" className="w-32 rounded-full border px-3 py-1.5 text-xs" /><button disabled={!newOption[item.id]?.trim()||busy} onClick={()=>{void post({action:"option",menuItemId:item.id,name:newOption[item.id],required:false,sortOrder:(item.restaurant_menu_item_options||[]).length});setNewOption(v=>({...v,[item.id]:""}))}} className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">Add option</button></div></div>
          <div className="mt-4 space-y-3">{(item.restaurant_menu_item_options||[]).map(option=><div key={option.id} className="rounded-xl border bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-medium">{option.name}</span><span className="ml-2 text-xs text-slate-500">{option.required?"Required":"Optional"} · {option.active?"Active":"Hidden"}</span></div><button disabled={busy} onClick={()=>void patch({type:"option",id:option.id,active:!option.active})} className="rounded-full border px-2.5 py-1 text-xs">{option.active?"Hide":"Show"}</button></div><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void patch({type:"option",id:option.id,required:!option.required})} className="rounded-full border px-2.5 py-1 text-xs">Make {option.required?"optional":"required"}</button><input value={newValue[option.id]||""} onChange={e=>setNewValue(v=>({...v,[option.id]:e.target.value}))} placeholder="Value" className="w-24 rounded-full border px-3 py-1 text-xs" /><input id={`delta-${option.id}`} placeholder="+/- price" inputMode="decimal" className="w-24 rounded-full border px-3 py-1 text-xs" /><button disabled={!newValue[option.id]?.trim()||busy} onClick={()=>{const el=document.getElementById(`delta-${option.id}`) as HTMLInputElement|null;void post({action:"option_value",optionId:option.id,name:newValue[option.id],priceDelta:Number(el?.value||0),sortOrder:(option.restaurant_menu_item_option_values||[]).length});setNewValue(v=>({...v,[option.id]:""}));if(el)el.value=""}} className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">Add value</button></div><div className="mt-2 flex flex-wrap gap-2">{(option.restaurant_menu_item_option_values||[]).map(value=><button key={value.id} disabled={busy} onClick={()=>void patch({type:"option_value",id:value.id,active:!value.active})} className={`rounded-full border px-3 py-1 text-xs ${value.active?"":"opacity-50"}`}>{value.name}{Number(value.price_delta)!==0?` (${Number(value.price_delta)>0?"+":""}${Number(value.price_delta).toLocaleString()})`:""}</button>)}</div></div>)}</div>
        </div>
      </article>)}{!items.length&&<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">No menu items yet.</div>}</div>
    </section>
  </div></main>;
}
