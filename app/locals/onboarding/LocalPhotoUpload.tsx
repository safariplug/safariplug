"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = { userId: string; initialUrl?: string | null };

export default function LocalPhotoUpload({ userId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Use a JPEG, PNG, or WebP photo."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be 5 MB or smaller."); return; }
    setBusy(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/profile-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("local-profile-photos").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (uploadError) { setError(uploadError.message); setBusy(false); return; }
    const { data } = supabase.storage.from("local-profile-photos").getPublicUrl(path);
    setUrl(data.publicUrl);
    setBusy(false);
  }

  return <div className="grid gap-3">
    <label className="text-sm font-semibold">Personal photo *</label>
    {url && <img src={url} alt="Your Local profile" className="h-40 w-40 rounded-3xl object-cover" />}
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} className="text-sm" />
    <input type="hidden" name="personal_photo_url" value={url} />
    <p className="text-xs leading-5 text-black/45">{busy ? "Uploading…" : "Upload a clear photo of yourself. JPEG, PNG or WebP, maximum 5 MB. Your profile cannot be submitted without a personal photo."}</p>
    {error && <p className="text-xs font-semibold text-red-700">{error}</p>}
  </div>;
}
