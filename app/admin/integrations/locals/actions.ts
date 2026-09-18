"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function reviewLocal(formData: FormData) {
  await requireAdmin();
  const localId = value(formData, "local_id");
  const decision = value(formData, "decision");
  const reason = value(formData, "reason");
  if (!localId || !["approve", "reject"].includes(decision)) throw new Error("Invalid Local review request.");

  const { data: local, error } = await supabaseAdmin.from("local_profiles").select("id,personal_photo_url,display_name").eq("id", localId).maybeSingle();
  if (error || !local) throw new Error("Local profile could not be loaded.");
  if (decision === "approve" && !local.personal_photo_url) throw new Error("A personal photo is required before verification approval.");

  const caseStatus = decision === "approve" ? "approved" : "rejected";
  const profileState = decision === "approve" ? "verified" : "rejected";
  const { data: verificationCase } = await supabaseAdmin.from("verification_cases").select("id,provider").eq("subject_type", "local").eq("subject_id", localId).in("status", ["pending", "in_review"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!verificationCase) throw new Error("No pending identity review exists for this Local.");
  if (verificationCase.provider === "sumsub") throw new Error("Sumsub controls identity/liveness approval for this Local. Staff cannot manually approve or reject the external result.");

  const now = new Date().toISOString();
  const { error: caseError } = await supabaseAdmin.from("verification_cases").update({ status: caseStatus, reviewed_at: now, rejection_reason: decision === "reject" ? reason || "Identity review rejected." : null }).eq("id", verificationCase.id);
  if (caseError) throw new Error(caseError.message);
  const { error: profileError } = await supabaseAdmin.from("local_profiles").update({ verification_state: profileState, service_status: decision === "approve" ? "pending_review" : "paused" }).eq("id", localId);
  if (profileError) throw new Error(profileError.message);
  revalidatePath("/admin/integrations/locals");
  revalidatePath("/locals");
}

export async function setLocalActivation(formData: FormData) {
  await requireAdmin();
  const localId = value(formData, "local_id");
  const activate = value(formData, "activate") === "true";
  if (!localId) throw new Error("Local ID is required.");

  const { data: local, error } = await supabaseAdmin.from("local_profiles").select("id,verification_state,identity_liveness_verified_at,personal_photo_url,languages,interests").eq("id", localId).maybeSingle();
  if (error || !local) throw new Error("Local profile could not be loaded.");
  if (activate) {
    if (local.verification_state !== "verified") throw new Error("Identity verification is required before activation.");
    if (!local.identity_liveness_verified_at) throw new Error("Approved external live face/liveness verification is required before activation.");
    if (!local.personal_photo_url) throw new Error("A personal photo is required before activation.");
    if (!Array.isArray(local.languages) || !local.languages.length) throw new Error("At least one language is required before activation.");
    if (!Array.isArray(local.interests) || !local.interests.length) throw new Error("At least one interest is required before activation.");
  }
  const { error: updateError } = await supabaseAdmin.from("local_profiles").update({ service_status: activate ? "active" : "paused" }).eq("id", localId);
  if (updateError) throw new Error(updateError.message);
  revalidatePath("/admin/integrations/locals");
  revalidatePath("/locals");
}
