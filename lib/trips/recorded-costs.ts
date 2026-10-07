import { supabaseAdmin } from "@/lib/supabase-admin";

export type TripRecordedLine = {
  kind: string;
  sourceId: string;
  amount: number;
  currency: string;
  status: string | null;
};

export async function loadRecordedTripCosts(userId: string, tripId: string): Promise<TripRecordedLine[]> {
  const [bookings, appointments, transfers, food, hotelLedgers, activityLedgers, transferLedgers] = await Promise.all([
    supabaseAdmin.from("bookings").select("id,customer_total,customer_currency,status").eq("traveler_id",userId).eq("trip_id",tripId),
    supabaseAdmin.from("service_appointments").select("id,customer_total_amount,price,currency,status").eq("customer_user_id",userId).eq("trip_id",tripId),
    supabaseAdmin.from("driver_transfer_requests").select("id,quoted_amount,currency,status").eq("traveler_id",userId).eq("trip_id",tripId),
    supabaseAdmin.from("food_orders").select("id,customer_total,currency,status").eq("customer_user_id",userId).eq("trip_id",tripId),
    supabaseAdmin.from("hotel_booking_pricing_ledger").select("id,customer_retail_amount,retail_amount,customer_currency,currency,booking_status,metadata").eq("customer_user_id",userId).contains("metadata",{tripId}),
    supabaseAdmin.from("activity_booking_pricing_ledger").select("id,retail_amount,customer_currency,booking_status,metadata").eq("customer_user_id",userId).contains("metadata",{tripId}),
    supabaseAdmin.from("transfer_booking_pricing_ledger").select("id,retail_amount,customer_currency,booking_status,metadata").eq("customer_user_id",userId).contains("metadata",{tripId}),
  ]);

  const errors=[bookings.error,appointments.error,transfers.error,food.error,hotelLedgers.error,activityLedgers.error,transferLedgers.error].filter(Boolean);
  if(errors.length) throw errors[0];

  const lines:TripRecordedLine[]=[
    ...(bookings.data??[]).filter(x=>x.customer_total!=null).map(x=>({kind:"Experience",sourceId:x.id,amount:Number(x.customer_total),currency:String(x.customer_currency||"KES"),status:x.status})),
    ...(appointments.data??[]).map(x=>({kind:"Service",sourceId:x.id,amount:Number(x.customer_total_amount??x.price??0),currency:String(x.currency||"KES"),status:x.status})),
    ...(transfers.data??[]).filter(x=>x.quoted_amount!=null).map(x=>({kind:"Transfer",sourceId:x.id,amount:Number(x.quoted_amount),currency:String(x.currency||"KES"),status:x.status})),
    ...(food.data??[]).filter(x=>x.customer_total!=null).map(x=>({kind:"Food",sourceId:x.id,amount:Number(x.customer_total),currency:String(x.currency||"KES"),status:x.status})),
    ...(hotelLedgers.data??[]).map(x=>({kind:"Stay",sourceId:x.id,amount:Number(x.customer_retail_amount??x.retail_amount??0),currency:String(x.customer_currency??x.currency??"KES"),status:x.booking_status})),
    ...(activityLedgers.data??[]).map(x=>({kind:"Activity",sourceId:x.id,amount:Number(x.retail_amount??0),currency:String(x.customer_currency||"KES"),status:x.booking_status})),
    ...(transferLedgers.data??[]).map(x=>({kind:"Supplier transfer",sourceId:x.id,amount:Number(x.retail_amount??0),currency:String(x.customer_currency||"KES"),status:x.booking_status})),
  ];

  return lines.filter(line=>line.currency&&Number.isFinite(line.amount)&&line.amount>0);
}

export function tripCostTotals(lines:TripRecordedLine[]) {
  const totals:Record<string,number>={};
  for(const line of lines) totals[line.currency]=(totals[line.currency]||0)+line.amount;
  return totals;
}

export function tripBudgetPosition(input:{budgetAmount:number|null;budgetCurrency:string|null;totals:Record<string,number>}) {
  if(input.budgetAmount==null||!input.budgetCurrency)return null;
  const recorded=input.totals[input.budgetCurrency]||0;
  return {
    currency:input.budgetCurrency,
    budget:input.budgetAmount,
    recorded,
    remaining:input.budgetAmount-recorded,
    overBudget:recorded>input.budgetAmount,
    percentUsed:input.budgetAmount>0?Math.round((recorded/input.budgetAmount)*100):null,
  };
}
