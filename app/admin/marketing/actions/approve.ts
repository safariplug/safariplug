"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "safariplug-story";
}

function section(text: string, label: string, nextLabels: string[]) {
  const start = text.indexOf(label);
  if (start < 0) return "";
  const after = text.slice(start + label.length).replace(/^\s*[:\-]\s*/, "").trim();
  const nextPositions = nextLabels.map((next) => after.indexOf(next)).filter((position) => position >= 0);
  const end = nextPositions.length ? Math.min(...nextPositions) : after.length;
  return after.slice(0, end).trim();
}

export async function approveMarketingDraft(id: number) {
  await requireAdmin();

  const { data: draft, error: draftError } = await supabaseAdmin
    .from("marketing_drafts")
    .select("id, event_id, event_name, city, platform, draft_content, image_url, external_url")
    .eq("id", id)
    .eq("status", "draft")
    .single();

  if (draftError || !draft) {
    throw new Error(draftError?.message || "Marketing draft not found.");
  }

  const now = new Date().toISOString();

  if (draft.platform === "journal") {
    const { data: sourceEvent } = draft.event_id
      ? await supabaseAdmin
          .from("ai_discovered_events")
          .select("title, description, category, city, image_url")
          .eq("id", draft.event_id)
          .maybeSingle()
      : { data: null };

    const title = section(draft.draft_content || "", "SEO TITLE", ["META DESCRIPTION", "EXCERPT", "ARTICLE"]) || draft.event_name || "SafariPlug Journal";
    const metaDescription = section(draft.draft_content || "", "META DESCRIPTION", ["EXCERPT", "ARTICLE"]).slice(0, 160);
    const excerpt = section(draft.draft_content || "", "EXCERPT", ["ARTICLE"]).slice(0, 320);
    const body = section(draft.draft_content || "", "ARTICLE", []);
    const articleBody = body || draft.draft_content || sourceEvent?.description || "";
    const baseSlug = slugify(title);
    const slug = `${baseSlug}-${String(id)}`;

    const { error: journalError } = await supabaseAdmin
      .from("journal_articles")
      .insert({
        source_event_id: draft.event_id,
        title,
        slug,
        excerpt: excerpt || sourceEvent?.description?.slice(0, 320) || null,
        body: articleBody,
        meta_title: title.slice(0, 70),
        meta_description: metaDescription || excerpt || sourceEvent?.description?.slice(0, 160) || null,
        image_url: draft.image_url || sourceEvent?.image_url || null,
        category: sourceEvent?.category || null,
        city: draft.city || sourceEvent?.city || null,
        status: "published",
        published_at: now,
      });

    if (journalError) {
      throw new Error(journalError.message);
    }

    const { error: draftErrorAfterPublish } = await supabaseAdmin
      .from("marketing_drafts")
      .update({
        status: "approved",
        publish_status: "published",
        approved_at: now,
        approved_by: "admin",
        published_at: now,
        publish_error: null,
      })
      .eq("id", id)
      .eq("status", "draft");

    if (draftErrorAfterPublish) throw new Error(draftErrorAfterPublish.message);

    revalidatePath("/admin/marketing");
    revalidatePath("/journal");
    revalidatePath(`/journal/${slug}`);
    return;
  }

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .update({
      status: "approved",
      publish_status: "ready_to_publish",
      approved_at: now,
      approved_by: "admin",
      publish_error: null,
    })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}

export async function rejectMarketingDraft(id: number) {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("marketing_drafts")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/marketing");
}
