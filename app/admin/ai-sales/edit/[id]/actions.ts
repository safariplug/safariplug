"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";


export async function approveSalesProspect(
  id: string
) {
  await requireAdmin();

  const { error } =
    await supabaseAdmin
      .from("ai_sales_prospects")
      .update({
        status: "partner",
        review_status: "approved",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales"
  );


  redirect(
    "/admin/ai-sales"
  );

}



export async function rejectSalesProspect(
  id: string
) {
  await requireAdmin();

  const { error } =
    await supabaseAdmin
      .from("ai_sales_prospects")
      .update({
        status: "rejected",
        review_status: "rejected",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales"
  );


  redirect(
    "/admin/ai-sales"
  );

}