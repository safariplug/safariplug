"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffPhotoUpload({ staffId, hasPhoto }: { staffId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMessage("Uploading…");
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "staff");
    form.append("staff_id", staffId);
    const response = await fetch("/api/supplier/media", { method: "POST", body: form });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setMessage(data?.error || "Unable to upload photo.");
    setMessage("Photo uploaded.");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="mt-4">
      <label className="inline-flex cursor-pointer items-center rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white">
        {busy ? "Uploading…" : hasPhoto ? "Replace photo" : "Upload personal photo"}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="mt-2 text-xs text-black/45">JPG, PNG or other image format, up to 8MB.</p>
      {message && <p className="mt-2 text-xs font-medium text-black/60">{message}</p>}
    </div>
  );
}
