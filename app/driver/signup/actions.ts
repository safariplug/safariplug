"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { aiDocumentIsAutoApproved, verifyDriverDocument, type AIDocumentKind } from "@/lib/services/ai-document-verification";

const capabilities = new Set(["airport_transfer", "hotel_transfer", "long_distance", "city_transfer", "child_seat", "wheelchair_accessible", "large_luggage", "premium_vehicle"]);
const providerTypes = new Set(["independent_driver", "safariplug_driver", "transport_company", "hotel_driver", "tour_operator"]);
const documentTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const TERMS_VERSION = "driver-terms-v1-2026-09-04";
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

async function uploadDocument(file: FormDataEntryValue | null, driverId: string, kind: string) {
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_DOCUMENT_BYTES || !documentTypes.has(file.type)) throw new Error(`Please upload a valid ${kind} image or PDF (max 8MB).`);
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const path = `${driverId}/${kind}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabaseAdmin.storage.from("driver-verification").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Unable to securely store ${kind}: ${error.message}`);
  return path;
}

async function saveAIDocumentEvidence(input: { caseId: string; kind: AIDocumentKind; path: string; result: Awaited<ReturnType<typeof verifyDriverDocument>> }) {
  const accepted = aiDocumentIsAutoApproved(input.result);
  const { error } = await supabaseAdmin.from("verification_evidence").insert({ case_id: input.caseId, evidence_type: input.kind, status: accepted ? "accepted" : "submitted", provider: "ai_document_verification", storage_ref: input.path, submitted_at: new Date().toISOString(), reviewed_at: accepted ? new Date().toISOString() : null, metadata: { verification_method: "ai_document_verification", decision: input.result.decision, confidence: input.result.confidence, document_type_match: input.result.document_type_match, readable: input.result.readable, expired: input.result.expired, identity_match: input.result.identity_match, vehicle_match: input.result.vehicle_match, reference_match: input.result.reference_match, expiry_match: input.result.expiry_match, reasons: input.result.reasons, model: "gpt-5.6-luna", auto_approved: accepted } });
  if (error) throw new Error(`Unable to record AI document verification: ${error.message}`);
  return accepted;
}

export async function submitDriverApplication(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("service_city") ?? "").trim();
  const country = String(formData.get("service_country") ?? "Kenya").trim();
  const airport = String(formData.get("service_airport_code") ?? "").trim().toUpperCase();
  const providerType = String(formData.get("provider_type") ?? "independent_driver");
  const vehicleCategory = String(formData.get("vehicle_category") ?? "").trim();
  const vehicleModel = String(formData.get("vehicle_make_model") ?? "").trim();
  const registrationNumber = String(formData.get("registration_number") ?? "").trim().toUpperCase();
  const registrationExpiresOn = String(formData.get("registration_expires_on") ?? "").trim();
  const insurancePolicyNumber = String(formData.get("insurance_policy_number") ?? "").trim();
  const insuranceExpiresOn = String(formData.get("insurance_expires_on") ?? "").trim();
  const licenseNumber = String(formData.get("driving_license_number") ?? "").trim();
  const licenseExpiresOn = String(formData.get("driving_license_expires_on") ?? "").trim();
  const passengers = Number(formData.get("passenger_capacity") ?? 0);
  const luggage = Number(formData.get("luggage_capacity") ?? 0);
  const availableOn = String(formData.get("available_on") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const license = formData.get("driving_license");
  const insurance = formData.get("insurance_document");
  const registration = formData.get("registration_document");
  const termsAccepted = formData.get("terms_accepted") === "on";
  const selectedCapabilities = formData.getAll("capability").map(String).filter((value) => capabilities.has(value));

  if (!email || !password || password.length < 8 || !fullName || !phone || !city) redirect("/driver/signup?error=Please%20complete%20the%20required%20fields%20and%20use%20an%208%2B%20character%20password.");
  if (!providerTypes.has(providerType)) redirect("/driver/signup?error=Invalid%20driver%20provider%20type.");
  if (!vehicleCategory || !vehicleModel || !registrationNumber || !registrationExpiresOn || !insuranceExpiresOn || !licenseNumber || !licenseExpiresOn || !Number.isInteger(passengers) || passengers < 1) redirect("/driver/signup?error=Please%20complete%20all%20required%20vehicle%2C%20license%2C%20registration%20and%20insurance%20details.");
  if (!termsAccepted) redirect("/driver/signup?error=You%20must%20accept%20the%20SafariPlug%20Driver%20Terms%20and%20Conditions%20to%20apply.");
  if (!(license instanceof File) || license.size < 1) redirect("/driver/signup?error=Please%20upload%20your%20driving%20license.");
  if (!(insurance instanceof File) || insurance.size < 1) redirect("/driver/signup?error=Please%20upload%20your%20insurance%20document.");
  if (!(registration instanceof File) || registration.size < 1) redirect("/driver/signup?error=Please%20upload%20your%20vehicle%20registration.");

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: fullName, phone, account_type: "driver" } });
  if (authError || !authData.user) redirect(`/driver/signup?error=${encodeURIComponent(authError?.message ?? "Unable to create account.")}`);

  const userId = authData.user.id;
  let driverId: string | null = null;
  const uploadedPaths: string[] = [];
  try {
    const { data: driver, error: driverError } = await supabaseAdmin.from("driver_profiles").insert({ user_id: userId, display_name: fullName, provider_type: providerType, contact_ref: phone, service_status: "pending", verification_state: "unverified", capabilities: selectedCapabilities, service_country: country || null, service_city: city, service_airport_code: airport || null, source: "safariplug", driving_license_number: licenseNumber, driving_license_expires_on: licenseExpiresOn, terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }).select("id").single();
    if (driverError || !driver) throw new Error(driverError?.message ?? "Unable to create driver application.");
    driverId = driver.id;

    const licensePath = await uploadDocument(license, driver.id, "driving-license"); uploadedPaths.push(licensePath);
    const insurancePath = await uploadDocument(insurance, driver.id, "insurance"); uploadedPaths.push(insurancePath);
    const registrationPath = await uploadDocument(registration, driver.id, "vehicle-registration"); uploadedPaths.push(registrationPath);

    const { data: vehicle, error: vehicleError } = await supabaseAdmin.from("vehicles").insert({ driver_id: driver.id, category: vehicleCategory, make_model: vehicleModel, passenger_capacity: passengers, luggage_capacity: Number.isInteger(luggage) && luggage >= 0 ? luggage : null, accessibility: selectedCapabilities.includes("wheelchair_accessible"), status: "draft", registration_number: registrationNumber, registration_expires_on: registrationExpiresOn, registration_document_path: registrationPath, registration_document_uploaded_at: new Date().toISOString(), insurance_policy_number: insurancePolicyNumber || null, insurance_expires_on: insuranceExpiresOn, insurance_document_path: insurancePath, insurance_document_uploaded_at: new Date().toISOString() }).select("id").single();
    if (vehicleError || !vehicle) throw new Error(vehicleError?.message ?? "Unable to create vehicle application.");

    if (availableOn) {
      const { error: availabilityError } = await supabaseAdmin.from("driver_availability").insert({ driver_id: driver.id, available_on: availableOn, start_time: startTime || null, end_time: endTime || null, timezone: "Africa/Nairobi", status: "available" });
      if (availabilityError) throw new Error(availabilityError.message);
    }

    const { data: verificationCase, error: verificationError } = await supabaseAdmin.from("verification_cases").insert({ subject_type: "driver", subject_id: driver.id, status: "pending", verification_level: "enhanced", provider: "ai_document_verification", notes: "AI document verification will assess the license, vehicle registration and insurance. Ambiguous results require human review. Mandatory live face/liveness verification remains required before driver approval and booking eligibility." }).select("id").single();
    if (verificationError || !verificationCase) throw new Error(verificationError?.message ?? "Unable to create verification case.");

    const [licenseResult, registrationResult, insuranceResult] = await Promise.all([
      verifyDriverDocument({ path: licensePath, mimeType: license.type, kind: "license", expected: { name: fullName, license_number: licenseNumber, expiry: licenseExpiresOn, country } }),
      verifyDriverDocument({ path: registrationPath, mimeType: registration.type, kind: "vehicle_registration", expected: { name: fullName, registration_number: registrationNumber, vehicle: vehicleModel, expiry: registrationExpiresOn, country } }),
      verifyDriverDocument({ path: insurancePath, mimeType: insurance.type, kind: "insurance", expected: { name: fullName, policy_number: insurancePolicyNumber || null, vehicle: vehicleModel, expiry: insuranceExpiresOn, country } }),
    ]);

    const [licenseApproved, registrationApproved, insuranceApproved] = await Promise.all([
      saveAIDocumentEvidence({ caseId: verificationCase.id, kind: "license", path: licensePath, result: licenseResult }),
      saveAIDocumentEvidence({ caseId: verificationCase.id, kind: "vehicle_registration", path: registrationPath, result: registrationResult }),
      saveAIDocumentEvidence({ caseId: verificationCase.id, kind: "insurance", path: insurancePath, result: insuranceResult }),
    ]);
    const allDocumentsApproved = licenseApproved && registrationApproved && insuranceApproved;
    const note = allDocumentsApproved ? "AI document verification passed all three required documents. Awaiting mandatory identity and live face/liveness verification; documents alone cannot approve the driver." : "One or more documents require human review. Driver remains non-bookable until document review and mandatory identity/live face/liveness verification are complete.";
    const { error: caseUpdateError } = await supabaseAdmin.from("verification_cases").update({ status: "in_review", notes: note, updated_at: new Date().toISOString() }).eq("id", verificationCase.id);
    if (caseUpdateError) throw new Error(caseUpdateError.message);
  } catch (error) {
    if (uploadedPaths.length) await supabaseAdmin.storage.from("driver-verification").remove(uploadedPaths);
    await supabaseAdmin.auth.admin.deleteUser(userId, true);
    const message = error instanceof Error ? error.message : "Unable to submit application.";
    redirect(`/driver/signup?error=${encodeURIComponent(message)}`);
  }
  redirect(`/driver/application?submitted=1&driver=${encodeURIComponent(driverId ?? "")}`);
}
