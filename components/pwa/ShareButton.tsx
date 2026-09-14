"use client";

import { useState } from "react";

type ShareButtonProps = {
  title: string;
  text?: string;
  className?: string;
};

export function ShareButton({ title, text, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      console.error("SafariPlug share failed", error);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={className ?? "mt-4 w-full rounded-full border border-white/15 px-6 py-4 font-bold text-white transition hover:bg-white/10"}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
