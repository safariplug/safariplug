import { supabaseAdmin } from "@/lib/supabase-admin";

export type OpsAlert = {
  severity:"critical"|"warning"|"info";
  area:string;
  title:string;
  detail:string;
  count:number;
  href:string;
};

export async function loadProductionOpsSnapshot() {
  const now=Date.now();
  const since24h=new Date(now-24*60*60*1000).toISOString();
  const stale30m=new Date(now-30*60*1000).toISOString();
  const stale15m=new Date(now-15*60*1000).toISOString();

  const [
    hotels,activities,transfers,services,food,telemetry,
  ]=await Promise.all([
    supabaseAdmin.from("hotel_booking_pricing_ledger")
      .select("id,provider,payment_status,booking_status,payment_reference,created_at,updated_at,paid_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(500),
    supabaseAdmin.from("activity_booking_pricing_ledger")
      .select("id,provider,payment_status,booking_status,payment_reference,created_at,updated_at,paid_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(500),
    supabaseAdmin.from("transfer_booking_pricing_ledger")
      .select("id,provider,payment_status,booking_status,payment_reference,created_at,updated_at,paid_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(500),
    supabaseAdmin.from("service_appointments")
      .select("id,public_id,payment_status,status,created_at,updated_at,paid_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(500),
    supabaseAdmin.from("food_orders")
      .select("id,public_id,payment_status,status,created_at,updated_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(500),
    supabaseAdmin.from("admin_telemetry_logs")
      .select("id,action_type,metadata,created_at")
      .gte("created_at",since24h).order("created_at",{ascending:false}).limit(300),
  ]);
  const errors=[hotels.error,activities.error,transfers.error,services.error,food.error,telemetry.error].filter(Boolean);
  if(errors.length) throw errors[0];

  const ledgers=[
    ...(hotels.data||[]).map((row:any)=>({kind:"Hotel",...row})),
    ...(activities.data||[]).map((row:any)=>({kind:"Activity",...row})),
    ...(transfers.data||[]).map((row:any)=>({kind:"Transfer",...row})),
  ];
  const paymentFailed=ledgers.filter((row:any)=>row.payment_status==="failed");
  const bookingFailed=ledgers.filter((row:any)=>row.booking_status==="failed");
  const paidNotConfirmed=ledgers.filter((row:any)=>row.payment_status==="paid"&&row.booking_status!=="confirmed"&&Date.parse(row.updated_at||row.created_at)<Date.parse(stale15m));
  const stalePending=ledgers.filter((row:any)=>["pending","initiated"].includes(String(row.payment_status))&&Date.parse(row.updated_at||row.created_at)<Date.parse(stale30m));

  const serviceFailed=(services.data||[]).filter((row:any)=>row.payment_status==="failed");
  const serviceStale=(services.data||[]).filter((row:any)=>row.payment_status==="pending"&&Date.parse(row.updated_at||row.created_at)<Date.parse(stale30m));
  const foodFailed=(food.data||[]).filter((row:any)=>row.payment_status==="failed");
  const foodStale=(food.data||[]).filter((row:any)=>row.payment_status==="pending"&&Date.parse(row.updated_at||row.created_at)<Date.parse(stale30m));

  const telemetryIssues=(telemetry.data||[]).filter((row:any)=>/unmatched|failed|timeout|error/i.test(String(row.action_type||"")));

  const alertCandidates:OpsAlert[]=[
    {severity:"critical",area:"Payments",title:"Failed travel payments",detail:"Hotel/activity/transfer ledger payments failed in the last 24h.",count:paymentFailed.length,href:"/admin/integrations/reconciliation"},
    {severity:"critical",area:"Bookings",title:"Failed travel bookings",detail:"Connected travel bookings marked failed in the last 24h.",count:bookingFailed.length,href:"/admin/integrations/reconciliation"},
    {severity:"critical",area:"Reconciliation",title:"Paid but not confirmed",detail:"Paid travel ledgers still not confirmed after 15 minutes.",count:paidNotConfirmed.length,href:"/admin/integrations/reconciliation"},
    {severity:"warning",area:"Payments",title:"Stale pending travel payments",detail:"Travel payments still pending after 30 minutes.",count:stalePending.length,href:"/admin/integrations/reconciliation"},
    {severity:"critical",area:"Services",title:"Failed service payments",detail:"Direct SafariPlug service payments failed in the last 24h.",count:serviceFailed.length,href:"/admin/services/operations"},
    {severity:"warning",area:"Services",title:"Stale service payments",detail:"Service payments pending more than 30 minutes.",count:serviceStale.length,href:"/admin/services/operations"},
    {severity:"critical",area:"Food",title:"Failed food payments",detail:"Restaurant order payments failed in the last 24h.",count:foodFailed.length,href:"/admin/restaurants"},
    {severity:"warning",area:"Food",title:"Stale food payments",detail:"Restaurant payments pending more than 30 minutes.",count:foodStale.length,href:"/admin/restaurants"},
    {severity:"warning",area:"Integrations",title:"Unmatched/error telemetry",detail:"Operational telemetry requiring review in the last 24h.",count:telemetryIssues.length,href:"/admin/integrations"},
  ];
  const alerts=alertCandidates.filter((alert)=>alert.count>0);

  const travelVolume=ledgers.length;
  const confirmedTravel=ledgers.filter((row:any)=>row.booking_status==="confirmed").length;
  const paidTravel=ledgers.filter((row:any)=>row.payment_status==="paid").length;
  const serviceVolume=(services.data||[]).length;
  const servicePaid=(services.data||[]).filter((row:any)=>row.payment_status==="paid").length;

  return {
    generatedAt:new Date().toISOString(),
    alerts,
    summary:{
      travelVolume,
      confirmedTravel,
      paidTravel,
      serviceVolume,
      servicePaid,
      foodVolume:(food.data||[]).length,
      critical:alerts.filter(a=>a.severity==="critical").reduce((sum,a)=>sum+a.count,0),
      warning:alerts.filter(a=>a.severity==="warning").reduce((sum,a)=>sum+a.count,0),
    },
    recent:{
      paymentFailed:paymentFailed.slice(0,20),
      bookingFailed:bookingFailed.slice(0,20),
      paidNotConfirmed:paidNotConfirmed.slice(0,20),
      stalePending:stalePending.slice(0,20),
      telemetryIssues:telemetryIssues.slice(0,20),
    },
  };
}
