import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export default async function ServicePage({ params }: { params: Promise<{ slug:string }> }) {
  const { slug } = await params;
  const { data: s } = await supabaseAdmin.from("service_profiles").select("id,timezone,booking_notice_minutes,businesses!inner(name,slug,description,address),service_categories(name),service_offerings(id,name,description,duration_minutes,price,currency)").eq("status","active").eq("booking_status","open").eq("businesses.slug",slug).eq("service_offerings.status","active").maybeSingle();
  if (!s) notFound();
  return <main className="mx-auto max-w-4xl px-6 py-12"><p className="text-sm">{(s as any).service_categories?.name ?? "Services"}</p><h1 className="mt-2 text-4xl font-semibold">{(s as any).businesses.name}</h1><p className="mt-3 text-gray-600">{(s as any).businesses.description}</p><div className="mt-10 space-y-4">{((s as any).service_offerings ?? []).map((x:any)=><section key={x.id} className="rounded-2xl border p-5"><h2 className="text-xl font-semibold">{x.name}</h2><p className="mt-1 text-sm text-gray-600">{x.description}</p><p className="mt-3 text-sm">{x.duration_minutes} min · {x.currency} {Number(x.price).toLocaleString()}</p><p className="mt-3 text-sm text-gray-500">Online appointment selection is now enabled for this service. Provider availability is used at booking time.</p></section>)}</div></main>;
}