import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Supplier authentication required." }, { status: 401 });
  const { data: account } = await supabaseAdmin.from("supplier_accounts").select("business_id,onboarding_status").eq("user_id", user.id).maybeSingle();
  if (!account) return NextResponse.json({ error: "Supplier account not found." }, { status: 404 });
  if (["approved", "live"].includes(account.onboarding_status)) return NextResponse.json({ error: "This profile is locked after approval." }, { status: 409 });
  const form = await request.formData(); const file = form.get("file"); const kind = form.get("kind");
  if (!(file instanceof File) || !["logo","cover","gallery"].includes(String(kind))) return NextResponse.json({ error: "Image file and kind are required." }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 8MB." }, { status: 422 });
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${account.business_id}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage.from("supplier-media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data: urlData } = supabaseAdmin.storage.from("supplier-media").getPublicUrl(path);
  const url = urlData.publicUrl;
  if (kind === "gallery") {
    const { data: business } = await supabaseAdmin.from("businesses").select("supplier_gallery_urls").eq("id", account.business_id).single();
    const gallery = Array.from(new Set([...(business?.supplier_gallery_urls ?? []), url]));
    await supabaseAdmin.from("businesses").update({ supplier_gallery_urls: gallery }).eq("id", account.business_id).eq("owner_id", user.id);
  } else {
    await supabaseAdmin.from("businesses").update({ [kind === "logo" ? "logo_url" : "cover_image_url"]: url }).eq("id", account.business_id).eq("owner_id", user.id);
  }
  return NextResponse.json({ success: true, url, kind });
}
