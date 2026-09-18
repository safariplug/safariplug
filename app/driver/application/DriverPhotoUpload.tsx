"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  driverId: string;
  initialUrl?: string | null;
};

export default function DriverPhotoUpload({ userId, driverId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Use a JPEG, PNG or WebP photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Photo must be 5 MB or smaller.");
      return;
    }

    setBusy(true);
    try {
      const ext =
        file.type === "image/png" ? "png" :
        file.type === "image/webp" ? "webp" :
        "jpg";
      const path = `${userId}/profile-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("driver-profile-photos")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("driver-profile-photos")
        .getPublicUrl(path);

      const response = await fetch("/api/driver/profile-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          driverId,
          personalPhotoUrl: data.publicUrl,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to save driver photo.");

      setUrl(data.publicUrl);
      setMessage("Personal photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5">
      <div className="flex flex-wrap items-center gap-5">
        {url ? (
          <img src={url} alt="Driver profile" className="h-24 w-24 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-zinc-700 text-center text-[10px] uppercase tracking-wider text-zinc-600">
            Photo required
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Public driver photo</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Upload a clear photo of yourself. This is shown to travelers so they can recognize the driver they requested. It is separate from private identity/liveness evidence.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0])}
            className="mt-3 block max-w-full text-xs text-zinc-400"
          />
          {message ? <p className="mt-2 text-xs text-[#c9a86a]">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
