import type { ReactNode } from "react";
import Link from "next/link";

export default function AdminSuppliersLayout({ children }: { children: ReactNode }) {
  return <>
    {children}
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <Link href="/admin/suppliers/readiness" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg">Readiness queue</Link>
      <Link href="/admin/suppliers/ai-review" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20">AI review ✦</Link>
    </div>
  </>;
}
