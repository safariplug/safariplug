import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function verifyDigest(raw: string, digest: string | null, algorithm: string | null) {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!secret || !digest) return false;
  const alg = algorithm === "HMAC_SHA512_HEX" ? "sha512" : algorithm === "HMAC_SHA1_HEX" ? "sha1" : algorithm === "HMAC_SHA256_HEX" ? "sha256" : null;
  if (!alg) return false;
  const expected = crypto.createHmac(alg, secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8"); const b = Buffer.from(digest, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyDigest(raw, request.headers.get("x-payload-digest"), request.headers.get("x-payload-digest-alg"))) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (payload.testMode === true) return NextResponse.json({ ok: true, test: true });

  const type = typeof payload.type === "string" ? payload.type : "";
  const applicantId = typeof payload.applicantId === "string" ? payload.applicantId : "";
  const externalUserId = typeof payload.externalUserId === "string" ? payload.externalUserId : "";
  if (!applicantId && !externalUserId) return NextResponse.json({ ok: true });

  let query = supabaseAdmin.from("verification_cases").select("id,status,verification_level,subject_type,subject_id,external_id").eq("provider", "sumsub");
  const { data: current } = externalUserId ? await query.eq("external_id", externalUserId).maybeSingle() : await query.eq("external_id", applicantId).maybeSingle();
  let resolved = current;
  if (!resolved && applicantId && externalUserId) {
    const fallback = await supabaseAdmin.from("verification_cases").select("id,status,verification_level,subject_type,subject_id,external_id").eq("provider", "sumsub").eq("external_id", applicantId).maybeSingle();
    resolved = fallback.data;
  }
  if (!resolved) return NextResponse.json({ ok: true });

  const review = payload.reviewResult && typeof payload.reviewResult === "object" ? payload.reviewResult as Record<string, unknown> : {};
  const answer = typeof review.reviewAnswer === "string" ? review.reviewAnswer : "";
  let toStatus: string | null = null;
  const eventExternalRef = applicantId || externalUserId;

  if (type === "applicantCreated" && applicantId && resolved.external_id !== applicantId) {
    await supabaseAdmin.from("verification_cases").update({ external_id: applicantId }).eq("id", resolved.id);
  } else if (type === "applicantReviewed") {
    const approved = answer === "GREEN";
    toStatus = approved ? "approved" : "rejected";
    await supabaseAdmin.from("verification_cases").update({ status: toStatus, reviewed_at: new Date().toISOString(), rejection_reason: approved ? null : "Sumsub verification result was not approved." }).eq("id", resolved.id);
    if (approved) {
      for (const evidenceType of ["identity", "liveness"] as const) {
        const { data: existing } = await supabaseAdmin.from("verification_evidence").select("id").eq("case_id", resolved.id).eq("evidence_type", evidenceType).maybeSingle();
        const patch = { status: "accepted", provider: "sumsub", external_ref: eventExternalRef, reviewed_at: new Date().toISOString() };
        if (existing?.id) await supabaseAdmin.from("verification_evidence").update(patch).eq("id", existing.id); else await supabaseAdmin.from("verification_evidence").insert({ case_id: resolved.id, evidence_type: evidenceType, ...patch, submitted_at: new Date().toISOString() });
      }
    }
  } else if (["applicantPending", "applicantOnHold", "applicantAwaitingUser", "applicantAwaitingService"].includes(type)) {
    toStatus = "in_review";
    await supabaseAdmin.from("verification_cases").update({ status: "in_review" }).eq("id", resolved.id).in("status", ["pending", "not_started"]);
  }

  await supabaseAdmin.from("verification_events").insert({ case_id: resolved.id, event_type: `sumsub:${type || "unknown"}`, from_status: resolved.status, to_status: toStatus, actor: "sumsub", provider: "sumsub", external_ref: eventExternalRef || null, reason: answer || null });
  return NextResponse.json({ ok: true });
}
