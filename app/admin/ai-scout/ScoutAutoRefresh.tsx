"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ScoutAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const interval = window.setInterval(() => {
      router.refresh();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [active, router]);

  if (!active) return null;

  return (
    <span className="text-xs text-gray-500">
      Live · refreshes every 10s
    </span>
  );
}
