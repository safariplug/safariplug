"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runSalesScoutForm, type SalesScoutFormState } from "./actions/run-sales-scout";

const cities=["Nairobi","Mombasa","Diani","Kilifi","Malindi","Watamu","Lamu","Zanzibar","Kampala","Dar es Salaam","Accra","Lagos","Cape Town","Johannesburg","Cairo","Casablanca"];
const categories=["Barbers","Hair & Beauty","Spas & Massage","Tattoo Artists & Body Art","Nails","Lashes & Brows","Fitness & Personal Training","Yoga/Pilates/Mindfulness","Diving & Marine","Surfing & Board Sports","Water Sports & Kite","Tours & Local Guides","Photography & Content","Private Chefs & Cooking","Hotels","Restaurants","Nightlife","Tour Operators","Experiences","Beach Clubs"];

const initialState: SalesScoutFormState = { status: "idle", message: "" };

export function SupplierScoutForm(){
 const [state,formAction]=useActionState(runSalesScoutForm,initialState);
 return <form action={formAction} className="mt-6 grid gap-4 md:grid-cols-3">
  <select name="city" defaultValue="Nairobi" className="rounded-xl border p-3">{cities.map(c=><option key={c}>{c}</option>)}</select>
  <select name="category" defaultValue="Barbers" className="rounded-xl border p-3">{categories.map(c=><option key={c}>{c}</option>)}</select>
  <ScoutButton/>
  {state.message&&<div role="status" className={`md:col-span-3 rounded-xl border px-4 py-3 text-sm ${state.status==="success"?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-red-200 bg-red-50 text-red-800"}`}>{state.message}</div>}
 </form>
}

function ScoutButton(){
 const {pending}=useFormStatus();
 return <button type="submit" disabled={pending} aria-disabled={pending} className="rounded-xl bg-black px-6 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending?"Running Supplier Scout…":"Run Supplier Scout"}</button>
}
