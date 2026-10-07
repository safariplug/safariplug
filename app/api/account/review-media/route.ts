
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function traveler() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}

export async function POST(request: Request) {
  const user = await traveler();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const form = await request.formData();
  const reviewId = String(form.get("reviewId") || "").trim();
  const file = form.get("file");
  if (!reviewId || !(file instanceof File)) return NextResponse.json({ error: "Review and image are required." }, { status: 400 });
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return NextResponse.json({ error: "Use JPEG, PNG or WebP images." }, { status: 422 });
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 8MB." }, { status: 422 });

  const { data: review, error: reviewError } = await supabaseAdmin
    .from("traveler_reviews")
    .select("id,traveler_id,moderation_status")
    .eq("id", reviewId)
    .eq("traveler_id", user.id)
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (!["pending","approved"].includes(review.moderation_status)) return NextResponse.json({ error: "Media cannot be added to this review." }, { status: 409 });

  const { count } = await supabaseAdmin
    .from("traveler_review_media")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId)
    .neq("moderation_status", "rejected");
  if ((count || 0) >= 4) return NextResponse.json({ error: "Up to 4 review photos are allowed." }, { status: 409 });

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = user.id + "/" + reviewId + "/" + crypto.randomUUID() + "." + ext;

  const { error: uploadError } = await supabaseAdmin.storage.from("traveler-review-media").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: media, error } = await supabaseAdmin
    .from("traveler_review_media")
    .insert({
      review_id: reviewId,
      traveler_id: user.id,
      storage_path: path,
      content_type: file.type,
      file_size: file.size,
      moderation_status: "pending",
    })
    .select("id,review_id,moderation_status,created_at")
    .single();

  if (error) {
    await supabaseAdmin.storage.from("traveler-review-media").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media }, { status: 201 });
}
