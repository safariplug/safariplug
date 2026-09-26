"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

function complianceStatus(value: string | null | undefined) {
  if (!value) return "missing";
  const expiry = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(expiry.getTime())) return "missing";
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((expiry.getTime() - todayUtc) / 86400000);
  if (days < 0) return "expired";
  return days <= 60 ? "expiring_soon" : "valid";
}

export async function reviewDriverDocument(formData: FormData) {
  const admin = await requireAdmin();
  const evidenceId = String(formData.get("evidence_id") || "");
  const decision = String(formData.get("decision") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!evidenceId || !["accepted", "rejected"].includes(decision)) throw new Error("Valid document review action required.");
  if (decision === "rejected" && !reason) throw new Error("A rejection reason is required.");

  const { data: evidence, error: evidenceError } = await supabaseAdmin
    .from("verification_evidence")
    .select("id,case_id,evidence_type,status,storage_ref,metadata")
    .eq("id", evidenceId)
    .maybeSingle();
  if (evidenceError || !evidence) throw new Error("Verification evidence could not be loaded.");
  if (!["license", "vehicle_registration", "insurance"].includes(evidence.evidence_type)) throw new Error("Unsupported driver document type.");

  const { data: verificationCase, error: caseError } = await supabaseAdmin
    .from("verification_cases")
    .select("id,subject_type,subject_id")
    .eq("id", evidence.case_id)
    .maybeSingle();
  if (caseError || !verificationCase || verificationCase.subject_type !== "driver") throw new Error("Driver verification case could not be loaded.");

  const now = new Date().toISOString();
  const { error: updateEvidenceError } = await supabaseAdmin
    .from("verification_evidence")
    .update({
      status: decision,
      reviewed_at: now,
      rejection_reason: decision === "rejected" ? reason : null,
      provider: "human_review",
      metadata: {
        ...((evidence.metadata || {}) as Record<string, unknown>),
        reviewed_by: admin.id,
        review_method: "safariplug_staff",
      },
      updated_at: now,
    })
    .eq("id", evidence.id);
  if (updateEvidenceError) throw new Error(updateEvidenceError.message);

  if (evidence.evidence_type === "license") {
    const { data: driver } = await supabaseAdmin
      .from("driver_profiles")
      .select("driving_license_expires_on")
      .eq("id", verificationCase.subject_id)
      .maybeSingle();
    const status = decision === "rejected" ? "rejected" : complianceStatus(driver?.driving_license_expires_on);
    const { error } = await supabaseAdmin
      .from("driver_profiles")
      .update({ driving_license_compliance_status: status, updated_at: now })
      .eq("id", verificationCase.subject_id);
    if (error) throw new Error(error.message);
  } else {
    const column = evidence.evidence_type === "vehicle_registration" ? "registration_document_path" : "insurance_document_path";
    const expiryColumn = evidence.evidence_type === "vehicle_registration" ? "registration_expires_on" : "insurance_expires_on";
    const complianceColumn = evidence.evidence_type === "vehicle_registration" ? "registration_compliance_status" : "insurance_compliance_status";
    let query = supabaseAdmin
      .from("vehicles")
      .select(`id,${expiryColumn}`)
      .eq("driver_id", verificationCase.subject_id);
    if (evidence.storage_ref) query = query.eq(column, evidence.storage_ref);
    const { data: vehicle } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!vehicle) throw new Error("Matching driver vehicle could not be found.");
    const status = decision === "rejected" ? "rejected" : complianceStatus(String((vehicle as Record<string, unknown>)[expiryColumn] || ""));
    const { error } = await supabaseAdmin
      .from("vehicles")
      .update({ [complianceColumn]: status, updated_at: now })
      .eq("id", vehicle.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/integrations/drivers/document-verification");
  revalidatePath("/admin/integrations/drivers");
  revalidatePath("/driver/application");
}
