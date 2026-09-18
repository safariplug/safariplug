import { supabaseAdmin } from "@/lib/supabase-admin";

export type TravelerVerificationState = {
  required: true;
  verified: boolean;
  status:
    | "approved"
    | "pending"
    | "in_review"
    | "not_started"
    | "rejected"
    | "revoked"
    | "expired"
    | "missing";
  caseId: string | null;
  expiresAt: string | null;
  reason: string | null;
};

export async function getTravelerVerificationState(
  userId: string
): Promise<TravelerVerificationState> {
  const { data, error } = await supabaseAdmin
    .from("verification_cases")
    .select(
      "id,status,expires_at,rejection_reason,notes,created_at,updated_at"
    )
    .eq("subject_type", "traveler")
    .eq("subject_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Unable to load traveler verification: ${error.message}`);

  if (!data) {
    return {
      required: true,
      verified: false,
      status: "missing",
      caseId: null,
      expiresAt: null,
      reason: null,
    };
  }

  const expired =
    data.status === "approved" &&
    Boolean(data.expires_at) &&
    new Date(String(data.expires_at)).getTime() <= Date.now();

  return {
    required: true,
    verified: data.status === "approved" && !expired,
    status: expired ? "expired" : data.status,
    caseId: data.id,
    expiresAt: data.expires_at,
    reason: data.rejection_reason || data.notes || null,
  };
}

export async function assertTravelerVerified(userId: string) {
  const state = await getTravelerVerificationState(userId);
  if (!state.verified) {
    const error = new Error(
      "Complete SafariPlug identity and live face verification before continuing."
    ) as Error & {
      code?: string;
      status?: number;
      verification?: TravelerVerificationState;
    };
    error.code = "traveler_verification_required";
    error.status = 403;
    error.verification = state;
    throw error;
  }
  return state;
}

export function travelerVerificationErrorResponse(error: unknown) {
  const candidate = error as Error & {
    code?: string;
    status?: number;
    verification?: TravelerVerificationState;
  };
  if (candidate?.code !== "traveler_verification_required") return null;
  return {
    status: candidate.status || 403,
    body: {
      error: "traveler_verification_required",
      message: candidate.message,
      verification: candidate.verification || null,
      verificationUrl: "/account/verification",
    },
  };
}
