import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ORDER_TRANSITIONS: Record<string, string[]> = { pending:["accepted","rejected","cancelled"], accepted:["preparing","cancelled"], preparing:["ready","cancelled"], ready:["driver_assigned","picked_up","cancelled"], driver_assigned:["picked_up","cancelled"], picked_up:["on_the_way","delivered"], on_the_way:["delivered"], delivered:[], cancelled:[], rejected:[] };
const DRIVER_TRANSITIONS: Record<string, string[]> = { assigned:["accepted","declined","cancelled"], accepted:["arrived_at_restaurant","cancelled"], arrived_at_restaurant:["picked_up","cancelled"], picked_up:["on_the_way","delivered","cancelled"], on_the_way:["delivered","cancelled"], delivered:[], declined:[], cancelled:[] };

async function user() { const supabase=await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); return user&&!user.is_anonymous?user:null; }
async function supplierBusinessId(userId:string) { const {data}=await supabaseAdmin.from("supplier_accounts").select("business_id").eq("user_id",userId).maybeSingle(); return data?.business_id??null; }

export async function GET(request:Request) {
 const currentUser=await user(); if(!currentUser)return NextResponse.json({error:"Sign in required"},{status:401});
 const {searchParams}=new URL(request.url); const orderId=searchParams.get("orderId"); const businessId=searchParams.get("businessId"); const supplierView=searchParams.get("supplier")==="true";
 let query=supabaseAdmin.from("food_orders").select("*, food_order_items(*), food_delivery_assignments(*), businesses:business_id(id,name)").order("created_at",{ascending:false});
 if(orderId) query=query.eq("id",orderId);
 else if(businessId){const owned=await supplierBusinessId(currentUser.id);if(!owned||owned!==businessId)return NextResponse.json({error:"Supplier access denied"},{status:403});query=query.eq("business_id",businessId).limit(100);}
 else if(supplierView){const owned=await supplierBusinessId(currentUser.id);if(!owned)return NextResponse.json({error:"Supplier access denied"},{status:403});query=query.eq("business_id",owned).limit(100);}
 else query=query.eq("customer_user_id",currentUser.id).limit(50);
 const {data,error}=await query;if(error)return NextResponse.json({error:error.message},{status:500});if(orderId&&!data?.length)return NextResponse.json({error:"Order not found"},{status:404});
 if(orderId){const order=data?.[0];const owns=order.customer_user_id===currentUser.id;const owned=await supplierBusinessId(currentUser.id);const supplier=owned===order.business_id;const assignment=order.food_delivery_assignments?.find((a:{driver_id?:string})=>a.driver_id===currentUser.id);if(!owns&&!supplier&&!assignment)return NextResponse.json({error:"Order access denied"},{status:403});}
 const orders=data??[];
 const driverIds=[...new Set(orders.flatMap((order:any)=>(order.food_delivery_assignments??[]).filter((a:any)=>a.status!=="cancelled"&&a.status!=="declined"&&a.driver_id).map((a:any)=>a.driver_id)))] as string[];
 let drivers:Record<string,unknown>={};
 if(driverIds.length){const {data:driverRows}=await supabaseAdmin.from("driver_profiles").select("id,display_name,service_city,service_country,preferred,capabilities").in("id",driverIds);drivers=Object.fromEntries((driverRows??[]).map((driver:any)=>[driver.id,{id:driver.id,display_name:driver.display_name,service_city:driver.service_city,service_country:driver.service_country,preferred:driver.preferred,capabilities:driver.capabilities}]));}
 const enriched=orders.map((order:any)=>{const assignment=(order.food_delivery_assignments??[]).find((a:any)=>a.status!=="cancelled"&&a.status!=="declined"&&a.driver_id);return {...order,assigned_driver:assignment?.driver_id?drivers[assignment.driver_id]??null:null};});
 return NextResponse.json({orders:enriched});
}

export async function PATCH(request:Request) {
 const currentUser=await user();if(!currentUser)return NextResponse.json({error:"Sign in required"},{status:401});
 const body=await request.json();const {orderId,status,note,assignmentStatus,rating,customerNote,assignDriverId,assignmentSource}=body;if(!orderId)return NextResponse.json({error:"orderId is required"},{status:400});
 const {data:order,error:orderError}=await supabaseAdmin.from("food_orders").select("*").eq("id",orderId).maybeSingle();if(orderError)return NextResponse.json({error:orderError.message},{status:500});if(!order)return NextResponse.json({error:"Order not found"},{status:404});
 const owned=await supplierBusinessId(currentUser.id);const isSupplier=owned===order.business_id;const isCustomer=order.customer_user_id===currentUser.id;const {data:assignment}=await supabaseAdmin.from("food_delivery_assignments").select("*").eq("order_id",orderId).eq("driver_id",currentUser.id).order("created_at",{ascending:false}).limit(1).maybeSingle();const isDriver=Boolean(assignment);

 if(assignDriverId){
  if(!isSupplier)return NextResponse.json({error:"Only the restaurant can assign a driver"},{status:403});
  if(!["ready","driver_assigned"].includes(order.status))return NextResponse.json({error:"Order must be ready before assigning a delivery driver"},{status:409});
  if(!["restaurant","safariplug"].includes(assignmentSource))return NextResponse.json({error:"Invalid assignment source"},{status:400});
  const {data:driver}=await supabaseAdmin.from("driver_profiles").select("id").eq("id",assignDriverId).eq("service_status","active").eq("verification_state","verified").maybeSingle();
  if(!driver)return NextResponse.json({error:"Selected driver is not available"},{status:409});
  const {data:existing}=await supabaseAdmin.from("food_delivery_assignments").select("id,status,driver_id").eq("order_id",orderId).in("status",["assigned","accepted","arrived_at_restaurant","picked_up","on_the_way"]).limit(1).maybeSingle();
  if(existing)return NextResponse.json({error:"This order already has an active delivery assignment"},{status:409});
  const {data:created,error}=await supabaseAdmin.from("food_delivery_assignments").insert({order_id:orderId,driver_id:driver.id,assignment_source:assignmentSource,status:"assigned",delivery_fee:order.delivery_fee??0,assigned_by:currentUser.id}).select().single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  const {data:updated,error:updateError}=await supabaseAdmin.from("food_orders").update({status:"driver_assigned",updated_at:new Date().toISOString()}).eq("id",orderId).eq("status",order.status).select().single();
  if(updateError||!updated){await supabaseAdmin.from("food_delivery_assignments").delete().eq("id",created.id);return NextResponse.json({error:updateError?.message??"Order changed before driver assignment"},{status:409});}
  return NextResponse.json({order:updated,assignment:created});
 }

 if(status){
  if(!isSupplier&&!isCustomer&&!isDriver)return NextResponse.json({error:"Order access denied"},{status:403});
  if(isCustomer&&!isSupplier&&!isDriver&&status!=="cancelled")return NextResponse.json({error:"Customers can only cancel an order"},{status:403});
  if(isDriver&&!isSupplier&&!['picked_up','on_the_way','delivered'].includes(status))return NextResponse.json({error:"Driver cannot make this order transition"},{status:403});
  if(!(ORDER_TRANSITIONS[order.status]??[]).includes(status))return NextResponse.json({error:`Cannot move order from ${order.status} to ${status}`},{status:409});
  const now=new Date().toISOString();const update:Record<string,unknown>={status,updated_at:now};if(status==='accepted'){update.accepted_at=now;update.accepted_by=currentUser.id;}if(status==='ready')update.ready_at=now;if(status==='picked_up')update.picked_up_at=now;if(status==='delivered')update.delivered_at=now;if(status==='cancelled'||status==='rejected'){update.cancelled_at=now;update.cancellation_reason=note??null;}
  const {data:updated,error}=await supabaseAdmin.from("food_orders").update(update).eq("id",orderId).eq("status",order.status).select().single();if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({order:updated});
 }
 if(assignmentStatus){
  if(!isDriver&&!isSupplier)return NextResponse.json({error:"Driver access denied"},{status:403});if(!assignment)return NextResponse.json({error:"Delivery assignment not found"},{status:404});if(!(DRIVER_TRANSITIONS[assignment.status]??[]).includes(assignmentStatus))return NextResponse.json({error:`Cannot move delivery from ${assignment.status} to ${assignmentStatus}`},{status:409});
  const now=new Date().toISOString();const update:Record<string,unknown>={status:assignmentStatus,updated_at:now};if(assignmentStatus==='accepted')update.accepted_at=now;if(assignmentStatus==='picked_up')update.picked_up_at=now;if(assignmentStatus==='delivered')update.delivered_at=now;if(assignmentStatus==='arrived_at_restaurant')update.arrived_at=now;
  const {data:updated,error}=await supabaseAdmin.from("food_delivery_assignments").update(update).eq("id",assignment.id).eq("status",assignment.status).select().single();if(error)return NextResponse.json({error:error.message},{status:400});
  const synced:{[key:string]:string}={picked_up:'picked_up',on_the_way:'on_the_way',delivered:'delivered'};const nextOrder=synced[assignmentStatus];
  if(nextOrder&&(ORDER_TRANSITIONS[order.status]??[]).includes(nextOrder)){const ou:Record<string,unknown>={status:nextOrder,updated_at:now};if(nextOrder==='picked_up')ou.picked_up_at=now;if(nextOrder==='delivered')ou.delivered_at=now;await supabaseAdmin.from("food_orders").update(ou).eq("id",orderId).eq("status",order.status);}
  if(assignmentStatus==='accepted'&&order.status==='ready')await supabaseAdmin.from("food_orders").update({status:'driver_assigned',updated_at:now}).eq("id",orderId).eq("status","ready");
  return NextResponse.json({assignment:updated});
 }
 if(rating!==undefined||customerNote!==undefined){if(!isCustomer||order.status!=="delivered")return NextResponse.json({error:"Only the customer can rate a delivered order"},{status:403});const score=Number(rating);if(!Number.isInteger(score)||score<1||score>5)return NextResponse.json({error:"Rating must be between 1 and 5"},{status:400});const {data:updated,error}=await supabaseAdmin.from("food_delivery_assignments").update({customer_rating:score,customer_note:customerNote??null}).eq("id",assignment?.id??"").select().single();if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({assignment:updated});}
 return NextResponse.json({error:"No supported update supplied"},{status:400});
}
