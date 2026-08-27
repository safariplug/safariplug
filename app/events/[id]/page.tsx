import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import LuxuryImage from "@/components/LuxuryImage";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Event = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  venue_name: string | null;
  venue_address?: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  booking_url?: string | null;
  organizer_name?: string | null;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone:"Africa/Nairobi",
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric"
  }).format(new Date(date));
}

function formatPrice(
  price:number|null,
  currency:string|null
){
  if (price === null || price <= 0) return "Free";

  return new Intl.NumberFormat("en-KE",{
    style:"currency",
    currency: currency || "KES",
    maximumFractionDigits:0
  }).format(price);
}


export async function generateMetadata({
 params
}:{
 params:Promise<{id:string}>
}):Promise<Metadata>{

 const {id}=await params;

 const {data}=await supabase
 .from("ai_discovered_events")
 .select("title,description,image_url")
 .eq("id",id)
 .single();


 if(!data){
  return {
   title:"SafariPlug Experience"
  };
 }


 return {
  title:`${data.title} | SafariPlug`,
  description:
   data.description ||
   "Discover East Africa experiences.",
  openGraph:{
  images: data.image_url ? [data.image_url] : undefined
  }
 };

}



export default async function EventPage({
 params
}:{
 params:Promise<{id:string}>
}){

 const resolvedParams = await params;
 const eventId = resolvedParams.id;

 console.log("Attempting to fetch event with ID:", eventId);

 const {data,error}=await supabase
 .from("ai_discovered_events")
 .select("id, title, description, category, venue_name, price, currency, image_url, start_at, status")
 .eq("id",eventId)
 .single();


 if(error || !data){
  console.error("Supabase query error:", error?.message);
  notFound();
 }


 const event=data as Event;



 return (

 <main className="min-h-screen bg-black p-8 text-white md:p-16">


 <header className="border-b border-white/10 bg-[#0b0b0d]">

 <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

 <Link
 href="/"
 className="text-3xl font-black text-white"
 >
 Safari<span className="text-orange-500">Plug</span>
 </Link>


 <Link
 href="/events"
 className="mb-6 inline-block text-sm font-bold text-amber-400 hover:underline"
 >
 &larr; Back to all experiences
 </Link>

 </div>

 </header>



 <section className="relative h-[520px] overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">

 <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black p-6 text-center">
 <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
 {event.category || "SafariPlug"}
 </span>
 </div>

 <LuxuryImage
 src={event.image_url}
 alt={event.title}
 className="relative h-full w-full object-cover"
 />

 <div className="absolute inset-0 bg-black/50"/>


 <div className="absolute inset-0 flex items-end">

 <div className="mx-auto max-w-7xl w-full px-6 pb-14 text-white">


 <span className="rounded-full border border-[#c9a86a]/50 bg-[#c9a86a]/10 px-4 py-2 text-sm font-bold text-[#e7c98d]">
 {event.category || "SafariPlug"}
 </span>


 <h1 className="mt-6 font-serif text-5xl font-medium md:text-7xl">
 {event.title}
 </h1>


 <p className="mt-5 text-lg text-white/70">
 {formatDate(event.start_at)}
 </p>


 </div>

 </div>

 </section>



 <section className="mx-auto max-w-7xl px-6 py-14">


 <div className="grid gap-10 lg:grid-cols-[1fr_380px]">


 <div className="space-y-8">


 <article className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-xl">

 <h2 className="text-3xl font-black">
 About this experience
 </h2>


 <p className="mt-5 text-lg leading-8 text-white/60">
 {event.description ||
 "More details coming soon."}
 </p>

 </article>



 <article className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-xl">

 <h2 className="text-3xl font-black">
 Location
 </h2>


 <p className="mt-4 text-white/60">
 📍 {event.venue_name || "To be verified"}
 </p>


 <p className="text-white/40">
 {event.venue_address || ""}
 </p>

 </article>



 <article className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-xl">

 <h2 className="text-3xl font-black">
 Organizer
 </h2>


 <p className="mt-4 font-bold">
 {event.organizer_name ||
 "SafariPlug Partner"}
 </p>

 </article>


 </div>



 <aside>

 <div className="sticky top-10 rounded-3xl border border-white/10 bg-white/[0.05] p-8 shadow-xl">


 <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#c9a86a]">
 Tickets
 </p>


 <h3 className="mt-3 font-serif text-4xl font-medium">
 {formatPrice(
 event.price,
 event.currency
 )}
 </h3>


 {event.booking_url &&

 <a
 href={event.booking_url}
 target="_blank"
 className="mt-8 block rounded-full bg-[#e7c98d] px-6 py-4 text-center font-bold text-[#070708]"
 >
 Get Tickets →
 </a>

 }


 </div>

 </aside>


 </div>


 </section>



 </main>

 );

}