import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const METHODS = new Set(["pickup", "safari_driver", "customer_driver", "restaurant_delivery"]);
function distanceKm(a:number,b:number,c:number,d:number){const r=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,q=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return r*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}

function driverAreaMatches(driver:any, business:any, latitude:number, longitude:number) {
  if (driver.service_city_id && business.city_id && driver.service_city_id === business.city_id) return true;
  const serviceLat = Number(driver.service_lat);
  const serviceLng = Number(driver.service_lng);
  const radius = Number(driver.service_radius_km);
  if (Number.isFinite(serviceLat) && Number.isFinite(serviceLng) && Number.isFinite(radius) && radius > 0) {
    return distanceKm(serviceLat, serviceLng, latitude, longitude) <= radius;
  }
  return false;
}

export async function POST(request: Request) {
  const supabase=await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.is_anonymous||!(user.email_confirmed_at||user.phone_confirmed_at))return NextResponse.json({error:"A confirmed SafariPlug account is required to place a food order"},{status:401});
  const body=await request.json(); const {businessId,fulfillmentMethod,customerName,customerPhone,customerEmail,deliveryAddress,deliveryLatitude,deliveryLongitude,customerNotes,items,driverId,tripId}=body;
  if(!businessId||!METHODS.has(fulfillmentMethod)||!customerName||!customerPhone||!Array.isArray(items)||!items.length)return NextResponse.json({error:"Restaurant, delivery method, contact details and at least one item are required"},{status:400});
  if(["safari_driver","customer_driver","restaurant_delivery"].includes(fulfillmentMethod)&&!deliveryAddress)return NextResponse.json({error:"Delivery address is required"},{status:400});
  if(["safari_driver","customer_driver"].includes(fulfillmentMethod)&&(!Number.isFinite(Number(deliveryLatitude))||!Number.isFinite(Number(deliveryLongitude))))return NextResponse.json({error:"A map location is required for delivery pricing"},{status:400});
  if(fulfillmentMethod==="customer_driver"&&!driverId)return NextResponse.json({error:"Choose a driver"},{status:400});
  if(["pickup","restaurant_delivery"].includes(fulfillmentMethod)&&driverId)return NextResponse.json({error:"A driver cannot be selected for this delivery method"},{status:400});
  if(tripId){const {data:trip}=await supabaseAdmin.from("trips").select("id").eq("id",tripId).eq("traveler_id",user.id).maybeSingle();if(!trip)return NextResponse.json({error:"Trip not found"},{status:404});}
  const [{data:settings},{data:business}]=await Promise.all([supabaseAdmin.from("restaurant_settings").select("*").eq("business_id",businessId).maybeSingle(),supabaseAdmin.from("businesses").select("id,name,city_id,latitude,longitude").eq("id",businessId).maybeSingle()]);
  if(!settings?.ordering_enabled||!business)return NextResponse.json({error:"Online ordering is not currently available"},{status:409});
  if(fulfillmentMethod==="pickup"&&!settings.pickup_enabled)return NextResponse.json({error:"Pickup is unavailable"},{status:409});
  if(fulfillmentMethod==="safari_driver"&&!settings.safari_driver_enabled)return NextResponse.json({error:"SafariPlug delivery is unavailable"},{status:409});
  if(fulfillmentMethod==="customer_driver"&&!settings.customer_driver_enabled)return NextResponse.json({error:"Customer-selected drivers are unavailable"},{status:409});
  if(fulfillmentMethod==="restaurant_delivery"&&!settings.restaurant_delivery_enabled)return NextResponse.json({error:"Restaurant delivery is unavailable"},{status:409});
  let selectedDriver:null|{id:string} = null;
  if(driverId){
    const {data:driver}=await supabaseAdmin.from("driver_profiles").select("id,service_city_id,service_lat,service_lng,service_radius_km,capabilities,driving_license_compliance_status").eq("id",driverId).eq("service_status","active").eq("verification_state","verified").maybeSingle();
    if(!driver)return NextResponse.json({error:"Selected driver is not available"},{status:409});
    const latitude=Number(deliveryLatitude); const longitude=Number(deliveryLongitude);
    if(!driverAreaMatches(driver,business,latitude,longitude))return NextResponse.json({error:"Selected driver does not serve this restaurant or delivery area"},{status:409});
    if(driver.driving_license_compliance_status!=="compliant")return NextResponse.json({error:"Selected driver license compliance is not current"},{status:409});
    const {data:vehicles}=await supabaseAdmin.from("vehicles").select("id,status,registration_compliance_status,insurance_compliance_status").eq("driver_id",driver.id);
    const vehicle=(vehicles??[]).find((v:any)=>v.status==="active"&&v.registration_compliance_status==="compliant"&&v.insurance_compliance_status==="compliant");
    if(!vehicle)return NextResponse.json({error:"Selected driver has no compliant active vehicle"},{status:409});
    selectedDriver=driver;
  }
  const ids=[...new Set(items.map((i:any)=>String(i?.menuItemId||"")).filter(Boolean))];
  if(!ids.length)return NextResponse.json({error:"At least one valid menu item is required"},{status:400});
  const {data:menuItems}=await supabaseAdmin.from("restaurant_menu_items").select("id,name,price,currency,available,active").eq("business_id",businessId).in("id",ids);
  const byId=new Map((menuItems??[]).map(i=>[i.id,i])); let subtotal=0; const normalized=[]; let currency:string|null=null;
  for(const item of items){const menu=byId.get(item.menuItemId);const quantity=Number(item.quantity);if(!menu||!menu.active||!menu.available||!Number.isInteger(quantity)||quantity<1)return NextResponse.json({error:"One or more menu items are unavailable"},{status:409});const itemCurrency=String(menu.currency||"KES").toUpperCase();if(currency&&currency!==itemCurrency)return NextResponse.json({error:"All items in an order must use the same currency"},{status:409});currency=itemCurrency;const lineTotal=Number(menu.price)*quantity;subtotal+=lineTotal;normalized.push({menu_item_id:menu.id,item_name:menu.name,unit_price:menu.price,quantity,line_total:lineTotal,notes:item.notes??null});}
  if(!currency||!Number.isFinite(subtotal))return NextResponse.json({error:"Unable to calculate order total"},{status:409});
  if(subtotal<Number(settings.minimum_order_amount??0))return NextResponse.json({error:`Minimum order is ${settings.minimum_order_amount} ${currency}`},{status:409});
  let deliveryFee=0; if(fulfillmentMethod==="restaurant_delivery")deliveryFee=subtotal>=Number(settings.free_delivery_threshold??Number.MAX_SAFE_INTEGER)?0:Number(settings.restaurant_delivery_fee??0);
  if(["safari_driver","customer_driver"].includes(fulfillmentMethod)){const restaurantLat=Number(business.latitude);const restaurantLng=Number(business.longitude);if(!Number.isFinite(restaurantLat)||!Number.isFinite(restaurantLng)||restaurantLat<-90||restaurantLat>90||restaurantLng<-180||restaurantLng>180)return NextResponse.json({error:"Restaurant delivery location is not configured"},{status:409});const km=distanceKm(restaurantLat,restaurantLng,Number(deliveryLatitude),Number(deliveryLongitude));if(!Number.isFinite(km))return NextResponse.json({error:"Unable to calculate delivery distance"},{status:409});const base=fulfillmentMethod==="safari_driver"?Number(settings.safari_driver_base_fee??150):Number(settings.customer_driver_base_fee??150);const perKm=fulfillmentMethod==="safari_driver"?Number(settings.safari_driver_per_km??30):Number(settings.customer_driver_per_km??30);deliveryFee=Math.ceil((base+km*perKm)/10)*10;}
  const total=subtotal+deliveryFee; const prepMinutes=Number(settings.preparation_time_minutes??30); const deliveryMinutes=fulfillmentMethod==="pickup"?0:25; const etaAt=new Date(Date.now()+(prepMinutes+deliveryMinutes)*60000).toISOString();
  const {data:order,error}=await supabaseAdmin.from("food_orders").insert({business_id:businessId,customer_user_id:user.id,trip_id:tripId??null,customer_name:customerName,customer_phone:customerPhone,customer_email:customerEmail??user.email??null,fulfillment_method:fulfillmentMethod,payment_status:"unpaid",currency,subtotal,delivery_fee:deliveryFee,customer_total:total,pickup_address:fulfillmentMethod==="pickup"?deliveryAddress??null:null,delivery_address:fulfillmentMethod==="pickup"?null:deliveryAddress,delivery_latitude:deliveryLatitude??null,delivery_longitude:deliveryLongitude??null,customer_notes:customerNotes??null,estimated_prep_minutes:prepMinutes,estimated_delivery_minutes:deliveryMinutes,eta_at:etaAt}).select().single();
  if(error||!order)return NextResponse.json({error:error?.message??"Unable to create order"},{status:400}); const {error:itemsError}=await supabaseAdmin.from("food_order_items").insert(normalized.map((i:any)=>({...i,order_id:order.id}))); if(itemsError){await supabaseAdmin.from("food_orders").delete().eq("id",order.id);return NextResponse.json({error:itemsError.message},{status:400});}
  if(selectedDriver){const {error:e}=await supabaseAdmin.from("food_delivery_assignments").insert({order_id:order.id,driver_id:selectedDriver.id,assignment_source:fulfillmentMethod==="customer_driver"?"customer":"safariplug",status:"assigned",delivery_fee:deliveryFee});if(e){await supabaseAdmin.from("food_order_items").delete().eq("order_id",order.id);await supabaseAdmin.from("food_orders").delete().eq("id",order.id);return NextResponse.json({error:"Unable to assign delivery driver"},{status:400});}}

  let itineraryItemAttached = false;
  if (tripId) {
    const { count } = await supabaseAdmin.from("trip_items").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
    const { error: itineraryError } = await supabaseAdmin.from("trip_items").insert({trip_id: tripId,item_kind: "food_order",food_order_id: order.id,title: `${business.name} food order`,notes: `${fulfillmentMethod.replaceAll("_", " ")} · ${order.public_id || order.id}`,start_at: etaAt,position: count ?? 0});
    itineraryItemAttached = !itineraryError;
    if (itineraryError) console.error("Unable to attach food order to itinerary", { orderId: order.id, tripId, error: itineraryError.message });
  }
  return NextResponse.json({order,deliveryFee,etaAt,itineraryItemAttached});
}

export async function GET(){const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user||user.is_anonymous)return NextResponse.json({error:"Sign in required"},{status:401});const {data,error}=await supabaseAdmin.from("food_orders").select("*, food_order_items(*), food_delivery_assignments(*)").eq("customer_user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({orders:data??[]});}