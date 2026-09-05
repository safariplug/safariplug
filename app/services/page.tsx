import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { data: services } = await supabaseAdmin.from("service_profiles").select("id,businesses!inner(name,slug,description),service_categories(name),service_offerings(id,name,duration_minutes,price,currency)").eq("status","active").eq("booking_status","open").eq("service_offerings.status","active");
  return <main className="mx-auto max-w-6xl px-6 py-12"><p className="text-sm font-medium">SafariPlug Services</p><h1 className="mt-2 text-4xl font-semibold">Book local services</h1><p className="mt-3 max-w-2xl text-gray-600">Discover salons, barbers, spas, wellness providers and other appointment-based businesses.</p><div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{(services ?? []).map((s:any)=><Link key={s.id} href={`/services/${s.businesses.slug}`} className="rounded-2xl border p-6 hover:shadow-md"><p className="text-xs uppercase tracking-wide text-gray-500">{s.service_categories?.name ?? "Service"}</p><h2 className="mt-2 text-xl font-semibold">{s.businesses.name}</h2><p className="mt-2 text-sm text-gray-600">{s.businesses.description}</p><p className="mt-4 text-sm">{(s.service_offerings ?? []).length} services available</p></Link>)}</div></main>;
}