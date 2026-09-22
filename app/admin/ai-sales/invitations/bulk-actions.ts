"use server";

import OpenAI from "openai";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PATH = "/admin/ai-sales/invitations";
const BATCH_LIMIT = 50;

function resultUrl(kind: "bulk" | "error", message: string) {
  return `${PATH}?${kind}=${encodeURIComponent(message)}`;
}

type DraftRow = {
  id: string;
  business_name: string;
  partner_type: string;
  contact_email: string | null;
  invitation_token: string;
};

type GeneratedDraft = {
  id: string;
  subject: string;
  message: string;
};

export async function generateAllPartnerInvitationDrafts() {
  await requireAdmin();

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI drafting is not configured on the server.");

    const { data: rows, error } = await supabaseAdmin
      .from("partner_invitations")
      .select("id,business_name,partner_type,contact_email,invitation_token")
      .eq("status", "draft")
      .not("contact_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw new Error(error.message);

    const drafts = (rows || []) as DraftRow[];
    if (!drafts.length) redirect(resultUrl("bulk", "No email invitation drafts need AI generation."));

    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
    const jobs = drafts.map((row) => ({
      id: row.id,
      business_name: row.business_name,
      partner_type: row.partner_type,
      signup_link: `${site}/partners/join/${row.invitation_token}`,
      provisional_name: row.business_name === "Invited supplier",
    }));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_SALES_SCOUT_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You are SafariPlug's governed supplier outreach assistant. Draft concise factual recruitment emails. Never invent contact names, business facts, relationships, earnings, booking volume, verification, or guarantees. If provisional_name is true, do not use the placeholder business name in the subject or body. Explain that SafariPlug helps travelers discover and book trusted African travel, hospitality, and local services; partners control their profile, offerings, rates, and availability; signup does not automatically verify or activate them. Return JSON only.",
        },
        {
          role: "user",
          content:
            "Create one email draft for every item below. Include each exact signup_link. Return exactly this JSON shape: {\"drafts\":[{\"id\":\"uuid\",\"subject\":\"string\",\"message\":\"plain text string\"}]}. Items:\n" +
            JSON.stringify(jobs),
        },
      ],
    });

    const raw = response.output_text?.trim();
    if (!raw) throw new Error("AI returned an empty bulk draft response.");

    let parsed: { drafts?: GeneratedDraft[] };
    try {
      parsed = JSON.parse(raw) as { drafts?: GeneratedDraft[] };
    } catch {
      throw new Error("AI returned invalid bulk draft JSON.");
    }

    const generated = Array.isArray(parsed.drafts) ? parsed.drafts : [];
    const byId = new Map(generated.map((draft) => [draft.id, draft]));
    let updated = 0;
    let skipped = 0;

    for (const row of drafts) {
      const draft = byId.get(row.id);
      if (!draft?.subject?.trim() || !draft?.message?.trim()) {
        skipped++;
        continue;
      }

      const { data: changed, error: updateError } = await supabaseAdmin
        .from("partner_invitations")
        .update({
          ai_subject: draft.subject.trim(),
          ai_message: draft.message.trim(),
          status: "ready_for_approval",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Bulk AI draft update failed", row.id, updateError);
        skipped++;
      } else if (changed) {
        updated++;
      } else {
        skipped++;
      }
    }

    revalidatePath(PATH);
    redirect(
      resultUrl(
        "bulk",
        `Generated ${updated} AI draft${updated === 1 ? "" : "s"}.${skipped ? ` ${skipped} could not be generated or had changed status.` : ""} Review and approve before sending.`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate bulk AI drafts.";
    redirect(resultUrl("error", message));
  }
}

export async function sendAllApprovedPartnerInvitations() {
  await requireAdmin();

  try {
    if (!process.env.RESEND_API_KEY) throw new Error("Email delivery is not configured on the server.");

    const { data: rows, error } = await supabaseAdmin
      .from("partner_invitations")
      .select("*")
      .eq("status", "approved")
      .not("contact_email", "is", null)
      .order("approved_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw new Error(error.message);

    const invitations = rows || [];
    if (!invitations.length) redirect(resultUrl("bulk", "No approved email invitations are waiting to be sent."));

    const resend = new Resend(process.env.RESEND_API_KEY);
    let sentCount = 0;
    let failed = 0;

    for (const invitation of invitations) {
      if (!invitation.contact_email || !invitation.ai_subject || !invitation.ai_message) {
        failed++;
        continue;
      }

      try {
        const sent = await resend.emails.send({
          from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
          to: invitation.contact_email,
          subject: invitation.ai_subject,
          text: invitation.ai_message,
        });

        if (sent.error) {
          console.error("Bulk email provider rejected invitation", invitation.id, sent.error);
          failed++;
          continue;
        }

        const now = new Date().toISOString();
        const { data: changed, error: updateError } = await supabaseAdmin
          .from("partner_invitations")
          .update({ status: "sent", sent_at: now, updated_at: now })
          .eq("id", invitation.id)
          .eq("status", "approved")
          .select("id")
          .maybeSingle();

        if (updateError || !changed) {
          console.error("Bulk invitation sent but status sync failed", invitation.id, updateError);
          failed++;
          continue;
        }

        if (invitation.prospect_id) {
          await supabaseAdmin
            .from("ai_sales_prospects")
            .update({ status: "contacted", updated_at: now })
            .eq("id", invitation.prospect_id);

          await supabaseAdmin.from("crm_activities").insert({
            prospect_id: invitation.prospect_id,
            partner_id: invitation.partner_id || null,
            contact_id: invitation.contact_id || null,
            activity_type: "email",
            summary: "Approved partner invitation sent",
            details: `Invitation ${invitation.id} was sent from the bulk approved-send action after human approval.`,
          });

          const { data: existingFollowup } = await supabaseAdmin
            .from("crm_followups")
            .select("id")
            .eq("prospect_id", invitation.prospect_id)
            .eq("status", "open")
            .ilike("title", "%invitation%")
            .limit(1)
            .maybeSingle();

          if (!existingFollowup) {
            await supabaseAdmin.from("crm_followups").insert({
              prospect_id: invitation.prospect_id,
              title: "Follow up on partner invitation",
              due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              priority: "normal",
              notes: `Invitation ${invitation.id} sent; review response or opening status.`,
            });
          }
        }

        if (invitation.partner_id) {
          await supabaseAdmin
            .from("safari_partners")
            .update({ outreach_stage: "contacted" })
            .eq("id", invitation.partner_id);
        }

        sentCount++;
      } catch (sendError) {
        console.error("Bulk approved invitation send failed", invitation.id, sendError);
        failed++;
      }
    }

    revalidatePath(PATH);
    revalidatePath("/admin/crm");
    revalidatePath("/admin/ai-sales");

    redirect(
      resultUrl(
        "bulk",
        `Sent ${sentCount} approved invitation${sentCount === 1 ? "" : "s"}.${failed ? ` ${failed} failed and remain available for review/retry.` : ""}`,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send approved invitations.";
    redirect(resultUrl("error", message));
  }
}
