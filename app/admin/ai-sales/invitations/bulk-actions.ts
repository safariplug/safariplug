"use server";

import OpenAI from "openai";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { partnerInvitationEmailIdempotencyKey } from "@/lib/email/partner-invitation-idempotency";
import { deterministicPartnerInvitationDraft } from "@/lib/email/partner-invitation-draft";

const PATH = "/admin/ai-sales/invitations";
const BATCH_LIMIT = 50;
const AI_CHUNK_SIZE = 8;
const AI_CONCURRENCY = 2;

function isUsableEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const email = value.trim();
  const lower = email.toLowerCase();
  if (!email || lower.includes("[email") || lower.includes("protected") || lower.includes("example.") || lower.includes("noreply") || lower.includes("no-reply")) return false;
  if (/[\[\]<>\s]/.test(email)) return false;
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

function resultUrl(kind: "bulk" | "error", message: string) {
  return `${PATH}?${kind}=${encodeURIComponent(message)}`;
}

type DraftRow = {
  id: string;
  business_name: string;
  partner_type: string;
  contact_email: string | null;
  invitation_token: string;
  prospect_id: string | null;
  city?: string | null;
  description?: string | null;
  website?: string | null;
  source_name?: string | null;
  source_url?: string | null;
};

type GeneratedDraft = {
  id: string;
  subject: string;
  message: string;
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function parseGeneratedDrafts(raw: string): GeneratedDraft[] {
  const cleaned = raw.trim().replace(/^\`\`\`json\s*/i, "").replace(/\`\`\`$/i, "").trim();
  const parsed = JSON.parse(cleaned) as { drafts?: GeneratedDraft[] };
  return Array.isArray(parsed.drafts) ? parsed.drafts : [];
}

function aiCreditsUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return message.includes("no credits remaining") ||
    message.includes("insufficient_quota") ||
    message.includes("billing") ||
    message.includes("add credits");
}

async function generateDraftChunk(openai: OpenAI, rows: DraftRow[], site: string): Promise<GeneratedDraft[]> {
  const jobs = rows.map((row) => ({
    id: row.id,
    business_name: row.business_name,
    partner_type: row.partner_type,
    signup_link: `${site}/partners/join/${row.invitation_token}`,
    provisional_name: row.business_name === "Invited supplier",
    city: row.city || null,
    website: row.website || null,
    public_research_summary: row.description || null,
    research_source_name: row.source_name || null,
    research_source_url: row.source_url || null,
  }));

  const response = await openai.responses.create({
    model: process.env.OPENAI_SALES_SCOUT_MODEL || "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "You are SafariPlug's governed supplier outreach assistant. Draft concise, genuinely tailored recruitment emails using ONLY the supplied evidence. Open with a specific reason for outreach supported by the evidence; if evidence is thin, tailor only by supplier category and city. Do not mention scraping, AI, lead scoring, or that the business was researched. Never invent contact names, achievements, property features, relationships, earnings, booking volume, awards, ratings, verification, or guarantees. If provisional_name is true, do not use the placeholder business name in the subject or body. Explain that SafariPlug helps travelers discover and book trusted African travel, hospitality, and local services in one trip journey; partners control their profile, offerings, rates, and availability; signup does not automatically verify or activate them. Keep each message under 170 words. Return JSON only.",
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
  if (!raw) throw new Error("AI returned an empty draft response.");
  return parseGeneratedDrafts(raw);
}

export async function generateAllPartnerInvitationDrafts() {
  await requireAdmin();
  let finalUrl = resultUrl("error", "Unable to prepare invitation drafts.");

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("partner_invitations")
      .select("id,business_name,partner_type,contact_email,invitation_token,prospect_id")
      .eq("status", "draft")
      .not("contact_email", "is", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw new Error(error.message);

    const baseDrafts = ((rows || []) as DraftRow[]).filter((row) => isUsableEmail(row.contact_email));
    const prospectIds = [...new Set(baseDrafts.map((row) => row.prospect_id).filter(Boolean))] as string[];
    const { data: prospects, error: prospectError } = prospectIds.length
      ? await supabaseAdmin
          .from("ai_sales_prospects")
          .select("id,city,description,website,source_name,source_url")
          .in("id", prospectIds)
      : { data: [], error: null };
    if (prospectError) throw new Error(prospectError.message);
    const prospectById = new Map((prospects || []).map((prospect) => [prospect.id, prospect]));
    const drafts = baseDrafts.map((row) => {
      const prospect = row.prospect_id ? prospectById.get(row.prospect_id) : null;
      return {
        ...row,
        city: prospect?.city || null,
        description: prospect?.description || null,
        website: prospect?.website || null,
        source_name: prospect?.source_name || null,
        source_url: prospect?.source_url || null,
      };
    });
    if (!drafts.length) {
      finalUrl = resultUrl("bulk", "No email invitation drafts need preparation.");
    } else {
      const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.safariplug.com").replace(/\/$/, "");
      const prepared = new Map<string, GeneratedDraft>();
      for (const row of drafts) {
        const fallback = deterministicPartnerInvitationDraft({
          businessName: row.business_name,
          partnerType: row.partner_type,
          city: row.city,
          signupLink: `${site}/partners/join/${row.invitation_token}`,
        });
        prepared.set(row.id, { id: row.id, subject: fallback.subject, message: fallback.message });
      }

      const aiEnhancedIds = new Set<string>();
      let failedChunks = 0;

      if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const groups = chunks(drafts, AI_CHUNK_SIZE);

        let stopAiForRun = false;
        for (let index = 0; index < groups.length && !stopAiForRun; index += AI_CONCURRENCY) {
          const wave = groups.slice(index, index + AI_CONCURRENCY);
          const results = await Promise.allSettled(
            wave.map((group) => generateDraftChunk(openai, group, site)),
          );

          for (const result of results) {
            if (result.status === "fulfilled") {
              for (const generated of result.value) {
                if (!prepared.has(generated.id) || !generated.subject?.trim() || !generated.message?.trim()) continue;
                prepared.set(generated.id, {
                  id: generated.id,
                  subject: generated.subject.trim(),
                  message: generated.message.trim(),
                });
                aiEnhancedIds.add(generated.id);
              }
            } else {
              failedChunks++;
              console.error("Bulk AI invitation chunk failed; deterministic drafts will be used", result.reason);
              if (aiCreditsUnavailable(result.reason)) stopAiForRun = true;
            }
          }
        }
      }

      let updated = 0;
      let skipped = 0;
      let aiEnhanced = 0;
      let deterministic = 0;

      for (const row of drafts) {
        const draft = prepared.get(row.id);
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
          console.error("Bulk invitation draft update failed", row.id, updateError);
          skipped++;
        } else if (changed) {
          updated++;
          if (aiEnhancedIds.has(row.id)) aiEnhanced++;
          else deterministic++;
        } else {
          skipped++;
        }
      }

      revalidatePath(PATH);

      const details = [
        `Prepared ${updated} review-ready draft${updated === 1 ? "" : "s"}.`,
        aiEnhanced ? `${aiEnhanced} AI-enhanced.` : "",
        deterministic ? `${deterministic} used the zero-cost deterministic fallback.` : "",
        skipped ? `${skipped} remain as drafts and can be retried safely.` : "",
        failedChunks ? `${failedChunks} AI batch${failedChunks === 1 ? "" : "es"} failed, but fallback drafts were still prepared.` : "",
        "Review and approve before sending.",
      ].filter(Boolean).join(" ");
      finalUrl = resultUrl("bulk", details);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to prepare invitation drafts.";
    finalUrl = resultUrl("error", message);
  }

  redirect(finalUrl);
}

export async function sendAllApprovedPartnerInvitations() {
  await requireAdmin();
  let finalUrl = resultUrl("error", "Unable to send approved invitations.");

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
    if (!invitations.length) {
      finalUrl = resultUrl("bulk", "No approved email invitations are waiting to be sent.");
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      let sentCount = 0;
      let failed = 0;

      for (const invitation of invitations) {
        if (!isUsableEmail(invitation.contact_email) || !invitation.ai_subject || !invitation.ai_message) {
          failed++;
          continue;
        }

        try {
          const sent = await resend.emails.send({
            from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
            to: invitation.contact_email,
            subject: invitation.ai_subject,
            text: invitation.ai_message,
            tags: [
              { name: "email_kind", value: "partner_invitation" },
              { name: "invitation_id", value: invitation.id },
            ],
          }, {
            idempotencyKey: partnerInvitationEmailIdempotencyKey(invitation.id, invitation.approved_at),
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

      finalUrl = resultUrl(
        "bulk",
        `Sent ${sentCount} approved invitation${sentCount === 1 ? "" : "s"}.${failed ? ` ${failed} failed and remain available for review/retry.` : ""}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send approved invitations.";
    finalUrl = resultUrl("error", message);
  }

  redirect(finalUrl);
}


export async function approveAndSendAllReadyPartnerInvitations() {
  const admin = await requireAdmin();
  let finalUrl = resultUrl("error", "Unable to approve and send AI drafts.");

  try {
    if (!process.env.RESEND_API_KEY) throw new Error("Email delivery is not configured on the server.");

    const { data: rows, error } = await supabaseAdmin
      .from("partner_invitations")
      .select("*")
      .eq("status", "ready_for_approval")
      .not("contact_email", "is", null)
      .order("updated_at", { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) throw new Error(error.message);

    const invitations = (rows || []).filter(
      (row) => Boolean(isUsableEmail(row.contact_email) && row.ai_subject?.trim() && row.ai_message?.trim()),
    );

    if (!invitations.length) {
      finalUrl = resultUrl("bulk", "No review-ready email invitations are waiting for batch approval.");
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY);
      let sentCount = 0;
      let failed = 0;

      for (const invitation of invitations) {
        const approvedAt = new Date().toISOString();

        const { data: approvedRow, error: approvalError } = await supabaseAdmin
          .from("partner_invitations")
          .update({
            status: "approved",
            approved_at: approvedAt,
            updated_at: approvedAt,
          })
          .eq("id", invitation.id)
          .eq("status", "ready_for_approval")
          .select("id")
          .maybeSingle();

        if (approvalError || !approvedRow) {
          console.error("Bulk invitation approval failed", invitation.id, approvalError);
          failed++;
          continue;
        }

        try {
          const sent = await resend.emails.send({
            from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
            to: invitation.contact_email,
            subject: invitation.ai_subject,
            text: invitation.ai_message,
            tags: [
              { name: "email_kind", value: "partner_invitation" },
              { name: "invitation_id", value: invitation.id },
            ],
          }, {
            idempotencyKey: partnerInvitationEmailIdempotencyKey(invitation.id, approvedAt),
          });

          if (sent.error) {
            console.error("Bulk approved email provider rejected invitation", invitation.id, sent.error);
            failed++;
            continue;
          }

          const sentAt = new Date().toISOString();
          const { data: changed, error: updateError } = await supabaseAdmin
            .from("partner_invitations")
            .update({ status: "sent", sent_at: sentAt, updated_at: sentAt })
            .eq("id", invitation.id)
            .eq("status", "approved")
            .select("id")
            .maybeSingle();

          if (updateError || !changed) {
            console.error("Batch invitation sent but status sync failed", invitation.id, updateError);
            failed++;
            continue;
          }

          if (invitation.prospect_id) {
            await supabaseAdmin
              .from("ai_sales_prospects")
              .update({ status: "contacted", updated_at: sentAt })
              .eq("id", invitation.prospect_id);

            await supabaseAdmin.from("crm_activities").insert({
              prospect_id: invitation.prospect_id,
              partner_id: invitation.partner_id || null,
              contact_id: invitation.contact_id || null,
              activity_type: "email",
              summary: "AI outreach batch approved and sent",
              details: `Invitation ${invitation.id} was explicitly batch-approved by admin ${admin.id} and sent.`,
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
                notes: `Invitation ${invitation.id} sent from batch-approved AI outreach; review response or opening status.`,
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
          console.error("Batch approve-and-send failed", invitation.id, sendError);
          failed++;
        }
      }

      revalidatePath(PATH);
      revalidatePath("/admin/crm");
      revalidatePath("/admin/ai-sales");

      finalUrl = resultUrl(
        "bulk",
        `Batch approved and sent ${sentCount} invitation${sentCount === 1 ? "" : "s"}.${failed ? ` ${failed} failed and remain approved for retry.` : ""}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve and send AI drafts.";
    finalUrl = resultUrl("error", message);
  }

  redirect(finalUrl);
}
