import { supabaseAdmin } from "@/lib/supabase-admin";

export async function loadDestinationMarket(slug:string) {
  const { data: city, error: cityError } = await supabaseAdmin
    .from("cities")
    .select("id,name,country,slug")
    .eq("slug",slug)
    .maybeSingle();
  if (cityError) throw cityError;
  if (!city) return null;

  const now=new Date().toISOString();
  const [services,events,restaurants,drivers,locals] = await Promise.all([
    supabaseAdmin.from("service_profiles")
      .select("id,businesses!inner(id,name,slug,city_id,status),service_offerings!inner(id,status)")
      .eq("status","active").eq("booking_status","open").eq("businesses.city_id",city.id)
      .in("businesses.status",["active","ACTIVE"]).eq("service_offerings.status","active").limit(200),
    supabaseAdmin.from("events")
      .select("id,title,category,venue_name,start_at,image_url")
      .eq("city_id",city.id).eq("status","approved").gte("start_at",now).order("start_at",{ascending:true}).limit(12),
    supabaseAdmin.from("businesses")
      .select("id,name,slug,status,business_type,restaurant_settings!inner(ordering_enabled)")
      .eq("city_id",city.id).eq("business_type","Restaurant").in("status",["active","ACTIVE"])
      .eq("restaurant_settings.ordering_enabled",true).limit(100),
    supabaseAdmin.from("driver_profiles")
      .select("id,display_name,service_city,service_city_id,service_status,verification_state,personal_photo_url")
      .eq("service_status","active").eq("verification_state","verified").or(`service_city_id.eq.${city.id},service_city.ilike.%${city.name.replace(/[%_,]/g," ")}%`).limit(100),
    supabaseAdmin.from("local_profiles")
      .select("id,display_name,city,service_status,verification_state,personal_photo_url")
      .eq("service_status","active").eq("verification_state","verified").ilike("city",`%${city.name.replace(/[%_,]/g," ")}%`).limit(100),
  ]);
  const errors=[services.error,events.error,restaurants.error,drivers.error,locals.error].filter(Boolean);
  if(errors.length) throw errors[0];

  const serviceBusinesses=new Map<string,{id:string;name:string;slug:string}>();
  for(const profile of services.data||[]) {
    const business=(profile as any).businesses;
    if(business?.id) serviceBusinesses.set(String(business.id),{id:String(business.id),name:String(business.name),slug:String(business.slug||"")});
  }

  const counts={
    services:serviceBusinesses.size,
    events:(events.data||[]).length,
    restaurants:(restaurants.data||[]).length,
    drivers:(drivers.data||[]).length,
    locals:(locals.data||[]).length,
  };
  const directTotal=Object.values(counts).reduce((sum,n)=>sum+n,0);
  const density=directTotal>=20?"strong":directTotal>=8?"building":"thin";

  return {
    city,
    counts,
    directTotal,
    density,
    services:[...serviceBusinesses.values()].slice(0,8),
    events:(events.data||[]).slice(0,6),
    restaurants:(restaurants.data||[]).slice(0,6),
    drivers:(drivers.data||[]).slice(0,6),
    locals:(locals.data||[]).slice(0,6),
  };
}
