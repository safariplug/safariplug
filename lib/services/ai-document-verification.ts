import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type AIDocumentKind = "license" | "vehicle_registration" | "insurance";
export type AIDocumentDecision = "approved" | "review" | "rejected";

export type AIDocumentVerificationResult = {
  decision: AIDocumentDecision;
  confidence: number;
  document_type_match: boolean;
  readable: boolean;
  expired: boolean;
  identity_match: boolean | null;
  vehicle_match: boolean | null;
  reference_match: boolean | null;
  expiry_match: boolean;
  reasons: string[];
};

const MODEL = "gpt-5.6-luna";
const BUCKET = "driver-verification";

function parseJson(text: string): AIDocumentVerificationResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned) as Partial<AIDocumentVerificationResult>;
  const decision = parsed.decision === "approved" || parsed.decision === "rejected" ? parsed.decision : "review";
  return {
    decision,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
    document_type_match: Boolean(parsed.document_type_match),
    readable: Boolean(parsed.readable),
    expired: Boolean(parsed.expired),
    identity_match: parsed.identity_match == null ? null : Boolean(parsed.identity_match),
    vehicle_match: parsed.vehicle_match == null ? null : Boolean(parsed.vehicle_match),
    reference_match: parsed.reference_match == null ? null : Boolean(parsed.reference_match),
    expiry_match: Boolean(parsed.expiry_match),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 8) : ["AI returned no structured reason."],
  };
}

function promptFor(kind: AIDocumentKind, expected: Record<string, string | null>) {
  const labels = {
    license: "driving license",
    vehicle_registration: "vehicle registration document",
    insurance: "vehicle insurance document",
  } as const;
  return `You are SafariPlug's document verification engine. Analyze this uploaded ${labels[kind]} for onboarding. This is a visual/document consistency check, NOT a government registry lookup and you must not claim authenticity that cannot be established from the supplied document.

Expected application values (use only for comparison; do not repeat sensitive numbers in your response):
${JSON.stringify(expected)}

Check: correct document type, readability/completeness, apparent expiry status, whether the visible name/reference/vehicle details match the expected values where applicable, and obvious contradictions or signs of alteration. Do not infer identity from facial appearance. Do not invent missing values.

Return ONLY valid JSON with exactly these keys:
{"decision":"approved|review|rejected","confidence":0.0,"document_type_match":true,"readable":true,"expired":false,"identity_match":true,"vehicle_match":true,"reference_match":true,"expiry_match":true,"reasons":["short reason"]}

Decision rules: approved only when the document is clearly readable, appears to be the requested type, required comparisons match, is not expired, and there are no material contradictions. Use review when evidence is ambiguous, image quality is insufficient, a comparison cannot be confidently made, or anything potentially suspicious needs human review. Use rejected only for a clear wrong document, clearly expired document, or clear material mismatch. Keep reasons short and never include full license, policy, registration or other identity numbers.`;
}

export async function verifyDriverDocument(input: {
  path: string;
  mimeType: string;
  kind: AIDocumentKind;
  expected: Record<string, string | null>;
}): Promise<AIDocumentVerificationResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(input.path, 300);
  if (error || !data?.signedUrl) throw new Error(`Unable to create secure document URL: ${error?.message ?? "missing signed URL"}`);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const isPdf = input.mimeType === "application/pdf";
  const content = [
    { type: "input_text" as const, text: promptFor(input.kind, input.expected) },
    isPdf
      ? { type: "input_file" as const, file_url: data.signedUrl }
      : { type: "input_image" as const, image_url: data.signedUrl, detail: "high" as const },
  ];

  const response = await openai.responses.create({
    model: MODEL,
    input: [{ role: "user", content }],
  });

  try {
    return parseJson(response.output_text);
  } catch {
    return {
      decision: "review",
      confidence: 0,
      document_type_match: false,
      readable: false,
      expired: false,
      identity_match: null,
      vehicle_match: null,
      reference_match: null,
      expiry_match: false,
      reasons: ["AI verification returned an invalid structured result; manual review required."],
    };
  }
}

export function aiDocumentIsAutoApproved(result: AIDocumentVerificationResult) {
  return result.decision === "approved" &&
    result.confidence >= 0.9 &&
    result.document_type_match &&
    result.readable &&
    !result.expired &&
    result.expiry_match &&
    result.identity_match !== false &&
    result.vehicle_match !== false &&
    result.reference_match !== false;
}
