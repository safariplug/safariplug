import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createSupabaseServerClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user||user.is_anonymous)return NextResponse.json({error:"Sign in required."},{status:401});
  const body=await request.json().catch(()=>null);
  const amount=body?.amount==null||body.amount===""?null:Number(body.amount);
  const currency=body?.currency?String(body.currency).trim().toUpperCase():null;
  if(amount!==null&&(!Number.isFinite(amount)||amount<0))return NextResponse.json({error:"Budget amount must be zero or greater."},{status:400});
  if((amount!==null&&!currency)||(currency&&!/^[A-Z]{3}$/.test(currency)))return NextResponse.json({error:"Use a valid 3-letter budget currency."},{status:400});
  const {data,error}=await supabaseAdmin.from("trips")
    .update({budget_amount:amount,budget_currency:amount===null?null:currency})
    .eq("id",id).eq("traveler_id",user.id)
    .select("id,budget_amount,budget_currency")
    .maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  if(!data)return NextResponse.json({error:"Trip not found."},{status:404});
  return NextResponse.json({trip:data});
}