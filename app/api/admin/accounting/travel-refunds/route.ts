import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic="force-dynamic";

const products=new Set(["hotel","transfer","activity","service","food"]);
const resolutions=new Set(["refund_required","no_refund_due","refunded_externally"]);

export async function POST(request:Request){
  try{
    const admin=await requireAdmin();
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    const product=String(body.product||"");
    const ledgerId=String(body.ledgerId||"").trim();
    const provider=String(body.provider||"").trim();
    const reason=String(body.reason||"").trim();
    const notes=String(body.notes||"").trim();

    if(!products.has(product))return NextResponse.json({error:"Unsupported refund review product."},{status:400});
    if(!ledgerId||!provider||!reason)return NextResponse.json({error:"ledgerId, provider and reason are required."},{status:400});

    const {data:existing,error:existingError}=await supabaseAdmin
      .from("travel_refund_reviews")
      .select("*")
      .eq("product",product)
      .eq("ledger_id",ledgerId)
      .maybeSingle();
    if(existingError)throw new Error(existingError.message);

    if(action==="start_review"){
      if(existing?.status==="resolved")return NextResponse.json({error:"This refund review is already resolved."},{status:409});
      if(existing){
        const {error}=await supabaseAdmin.from("travel_refund_reviews").update({
          status:"in_review",
          notes:notes||existing.notes,
          assigned_to:admin.id,
          updated_at:new Date().toISOString(),
        }).eq("id",existing.id);
        if(error)throw new Error(error.message);
      }else{
        const {error}=await supabaseAdmin.from("travel_refund_reviews").insert({
          product,
          ledger_id:ledgerId,
          provider,
          reason,
          status:"in_review",
          notes:notes||null,
          assigned_to:admin.id,
        });
        if(error)throw new Error(error.message);
      }
      return NextResponse.json({ok:true,moneyMoved:false,message:"Refund review assigned. No payment action was taken."});
    }

    if(action==="reopen"){
      if(!existing)return NextResponse.json({error:"Only an existing resolved review can be reopened."},{status:404});
      if(existing.status!=="resolved")return NextResponse.json({error:"Only a resolved finance review can be reopened for correction."},{status:409});
      if(!notes)return NextResponse.json({error:"A correction reason is required before reopening a resolved review."},{status:400});
      const reopenedAt=new Date().toISOString();
      const {error}=await supabaseAdmin.from("travel_refund_reviews").update({
        status:"in_review",
        resolution:null,
        notes,
        assigned_to:admin.id,
        resolved_by:null,
        resolved_at:null,
        updated_at:reopenedAt,
      }).eq("id",existing.id);
      if(error)throw new Error(error.message);

      return NextResponse.json({
        ok:true,
        moneyMoved:false,
        paymentStatusChanged:false,
        message:"Finance review reopened for correction. The prior decision remains preserved in append-only history.",
      });
    }

    if(action==="resolve"){
      if(existing?.status==="resolved")return NextResponse.json({error:"This refund review is already resolved. Reopen it through the governed correction workflow before recording a new decision."},{status:409});
      const resolution=String(body.resolution||"");
      if(!resolutions.has(resolution))return NextResponse.json({error:"A valid resolution is required."},{status:400});
      if(!notes)return NextResponse.json({error:"Finance notes are required before resolving a refund review."},{status:400});
      const resolvedAt=new Date().toISOString();

      if(existing){
        const {error}=await supabaseAdmin.from("travel_refund_reviews").update({
          status:"resolved",
          resolution,
          notes,
          assigned_to:existing.assigned_to||admin.id,
          resolved_by:admin.id,
          resolved_at:resolvedAt,
          updated_at:resolvedAt,
        }).eq("id",existing.id);
        if(error)throw new Error(error.message);
      }else{
        const {error}=await supabaseAdmin.from("travel_refund_reviews").insert({
          product,
          ledger_id:ledgerId,
          provider,
          reason,
          status:"resolved",
          resolution,
          notes,
          assigned_to:admin.id,
          resolved_by:admin.id,
          resolved_at:resolvedAt,
        });
        if(error)throw new Error(error.message);
      }

      return NextResponse.json({
        ok:true,
        moneyMoved:false,
        paymentStatusChanged:false,
        message:"Finance review resolved. No refund was executed and payment truth was not changed.",
      });
    }

    return NextResponse.json({error:"Unsupported refund review action."},{status:400});
  }catch(error){
    const status=error instanceof AdminAuthError?error.status:500;
    return NextResponse.json({error:error instanceof Error?error.message:"Refund review failed."},{status});
  }
}
