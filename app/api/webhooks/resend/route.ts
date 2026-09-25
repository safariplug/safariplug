import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_WEBHOOK_ID = process.env.RESEND_WEBHOOK_ID?.trim() || "c82dbffb-7441-4711-9093-b9ac56264302";
let cachedWebhookSecret = "";

async function getWebhookSecret(apiKey: string) {
  const configured = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (configured) return configured;
  if (cachedWebhookSecret) return cachedWebhookSecret;

  const response = await fetch(`https://api.resend.com/webhooks/${RESEND_WEBHOOK_ID}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to load Resend webhook secret (${response.status}).`);
  const body = await response.json() as { signing_secret?: unknown };
  const secret = typeof body.signing_secret === "string" ? body.signing_secret.trim() : "";
  if (!secret) throw new Error("Resend webhook signing secret is unavailable.");
  cachedWebhookSecret = secret;
  return secret;
}

type ResendTags = Record<string, string> | Array<{ name?: string; value?: string }> | undefined;

type ResendEvent = {
  type: "email.bounced" | "email.complained" | "email.suppressed" | "email.failed" | "email.opened" | "email.clicked";
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    tags?: ResendTags;
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

function tagValue(tags: ResendTags, key: string) {
  if (!tags) return "";
  if (Array.isArray(tags)) {
    return String(tags.find((tag) => tag?.name === key)?.value || "").trim();
  }
  return String((tags as Record<string, string>)[key] || "").trim();
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function failureLabel(type: ResendEvent["type"]) {
  if (type === "email.bounced") return "bounced";
  if (type === "email.complained") return "complained";
  if (type === "email.suppressed") return "suppressed";
  return "failed";
}

function preservesEnrollmentStage(status: string) {
  return ["signup_started", "onboarding", "active"].includes(status);
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Resend API access is not configured." }, { status: 503 });
  }

  let secret = "";
  try {
    secret = await getWebhookSecret(apiKey);
  } catch (error) {
    console.error("Unable to load Resend webhook verification secret", error);
    return NextResponse.json({ ok: false, error: "Resend webhook verification is not configured." }, { status: 503 });
  }

  const raw = await request.text();
  const svixId = request.headers.get("svix-id") || "";
  const svixTimestamp = request.headers.get("svix-timestamp") || "";
  const svixSignature = request.headers.get("svix-signature") || "";

  let event: ResendEvent;
  try {
    const resend = new Resend(apiKey);
    event = resend.webhooks.verify({
      payload: raw,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: secret,
    }) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  const supported = ["email.bounced", "email.complained", "email.suppressed", "email.failed", "email.opened", "email.clicked"];
  if (!supported.includes(event.type)) return NextResponse.json({ ok: true, ignored: true });

  const invitationId = tagValue(event.data?.tags, "invitation_id");
  const recipient = cleanEmail(event.data?.to?.[0]);

  let invitation:
    | {
        id: string;
        prospect_id: string | null;
        partner_id: string | null;
        contact_id: string | null;
        contact_email: string | null;
        status: string;
      }
    | null = null;

  if (invitationId) {
    const { data } = await supabaseAdmin
      .from("partner_invitations")
      .select("id,prospect_id,partner_id,contact_id,contact_email,status")
      .eq("id", invitationId)
      .maybeSingle();
    invitation = data;
  } else if (recipient) {
    const { data } = await supabaseAdmin
      .from("partner_invitations")
      .select("id,prospect_id,partner_id,contact_id,contact_email,status")
      .ilike("contact_email", recipient)
      .in("status", ["sent", "opened", "signup_started", "onboarding", "active"])
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    invitation = data;
  }

  if (!invitation) {
    return NextResponse.json({ ok: true, reconciled: false, reason: "No matching partner invitation." });
  }

  const marker = `Resend webhook ${svixId || event.data?.email_id || event.created_at || event.type}`;
  if (invitation.prospect_id) {
    const { data: existing } = await supabaseAdmin
      .from("crm_activities")
      .select("id")
      .eq("prospect_id", invitation.prospect_id)
      .ilike("details", `%${marker}%`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, reconciled: true, duplicate: true });
    }
  }

  const now = new Date().toISOString();

  if (event.type === "email.opened" || event.type === "email.clicked") {
    if (event.type === "email.opened" && invitation.status === "sent") {
      await supabaseAdmin
        .from("partner_invitations")
        .update({ status: "opened", opened_at: now, updated_at: now })
        .eq("id", invitation.id)
        .eq("status", "sent");
    }

    if (invitation.prospect_id) {
      await supabaseAdmin.from("crm_activities").insert({
        prospect_id: invitation.prospect_id,
        partner_id: invitation.partner_id || null,
        contact_id: invitation.contact_id || null,
        activity_type: "email",
        summary: event.type === "email.opened" ? "Partner invitation opened" : "Partner invitation clicked",
        details: [
          marker,
          `Invitation ${invitation.id} generated a verified Resend ${event.type === "email.opened" ? "open" : "click"} event.`,
          "Later signup, onboarding, and activation stages are not downgraded by engagement events.",
        ].join(" "),
      });
    }

    return NextResponse.json({
      ok: true,
      reconciled: true,
      invitationId: invitation.id,
      status: event.type === "email.opened" ? "opened" : "clicked",
    });
  }

  const label = failureLabel(event.type);
  const providerMessage = event.data?.bounce?.message?.trim() || "";
  const email = cleanEmail(invitation.contact_email) || recipient;

  let preservedInvitationStage = preservesEnrollmentStage(invitation.status) ? invitation.status : "";

  if (!preservedInvitationStage) {
    const { data: failedRow, error: failedStatusError } = await supabaseAdmin
      .from("partner_invitations")
      .update({ status: "failed", updated_at: now })
      .eq("id", invitation.id)
      .not("status", "in", "(signup_started,onboarding,active)")
      .select("id")
      .maybeSingle();

    if (failedStatusError) {
      console.error("Could not record Resend invitation failure status", failedStatusError);
      return NextResponse.json({ ok: false, error: "Could not reconcile invitation delivery status." }, { status: 500 });
    }

    if (!failedRow) {
      const { data: latestInvitation } = await supabaseAdmin
        .from("partner_invitations")
        .select("status")
        .eq("id", invitation.id)
        .maybeSingle();
      if (latestInvitation && preservesEnrollmentStage(latestInvitation.status)) {
        preservedInvitationStage = latestInvitation.status;
      }
    }
  }

  const preserveInvitationStage = Boolean(preservedInvitationStage);

  if (invitation.prospect_id && email) {
    await supabaseAdmin
      .from("ai_sales_prospects")
      .update({ contact_email: null, updated_at: now })
      .eq("id", invitation.prospect_id)
      .ilike("contact_email", email);

    await supabaseAdmin
      .from("crm_followups")
      .update({
        status: "completed",
        completed_at: now,
        updated_at: now,
        notes: `Closed automatically after Resend reported the partner invitation email ${label}.`,
      })
      .eq("prospect_id", invitation.prospect_id)
      .eq("status", "open")
      .ilike("title", "%invitation%");
  }

  if (invitation.partner_id && email) {
    const { data: partner } = await supabaseAdmin
      .from("safari_partners")
      .select("email_or_phone,notes")
      .eq("id", invitation.partner_id)
      .maybeSingle();

    if (partner && cleanEmail(partner.email_or_phone) === email) {
      const note = `Resend reported the recruitment email as ${label} on ${now.slice(0, 10)}. Do not reuse this address without reconfirmation.`;
      await supabaseAdmin
        .from("safari_partners")
        .update({
          email_or_phone: null,
          notes: [String(partner.notes || "").trim(), note].filter(Boolean).join("\n"),
        })
        .eq("id", invitation.partner_id);
    }
  }

  if (invitation.prospect_id) {
    await supabaseAdmin.from("crm_activities").insert({
      prospect_id: invitation.prospect_id,
      partner_id: invitation.partner_id || null,
      contact_id: invitation.contact_id || null,
      activity_type: "email",
      summary: preserveInvitationStage ? "Partner invitation email issue after enrollment" : "Partner invitation delivery failed",
      details: [
        marker,
        `Invitation ${invitation.id} was reported as ${label} by Resend.`,
        providerMessage ? `Provider detail: ${providerMessage}` : "",
        "The prospect email was cleared when it matched the failed recipient and open invitation follow-ups were closed.",
        preserveInvitationStage ? `Invitation workflow stage ${preservedInvitationStage} was preserved.` : "Invitation was marked failed.",
      ].filter(Boolean).join(" "),
    });
  }

  return NextResponse.json({ ok: true, reconciled: true, invitationId: invitation.id, status: preserveInvitationStage ? preservedInvitationStage : label, deliveryStatus: label, stagePreserved: preserveInvitationStage });
}
