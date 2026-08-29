"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";


export async function approveOutreach(
  formData: FormData
) {
  await requireAdmin();

  const id = formData.get("id") as string;

  const { error } =
    await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        approved: true,
        status: "approved",
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales/outreach"
  );

}



export async function markReadyToContact(
  formData: FormData
) {
  await requireAdmin();

  const id = formData.get("id") as string;


  const { error } =
    await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        status: "ready_to_contact",
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales/outreach"
  );

}



export async function markContacted(
  formData: FormData
) {
  await requireAdmin();

  const id = formData.get("id") as string;


  const { error } =
    await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        status: "contacted",
        sent_at: new Date().toISOString(),
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales/outreach"
  );

}



export async function markFollowUpRequired(
  formData: FormData
) {
  await requireAdmin();

  const id = formData.get("id") as string;


  const followUpDate =
    new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();


  const { error } =
    await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        status: "follow_up_required",
        follow_up_date: followUpDate,
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales/outreach"
  );

}



export async function updateFollowUpDetails(
  formData: FormData
) {
  await requireAdmin();

  const id =
    formData.get("id") as string;


  const followUpNotes =
    formData.get("follow_up_notes") as string;


  const outcome =
    formData.get("outcome") as string;


  const { error } =
    await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        follow_up_notes: followUpNotes,
        outcome,
      })
      .eq("id", id);


  if (error) {
    throw new Error(error.message);
  }


  revalidatePath(
    "/admin/ai-sales/outreach"
  );

}