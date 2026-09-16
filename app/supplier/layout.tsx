import type { ReactNode } from "react";
import Link from "next/link";

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return <>
    {children}
    <Link href="/supplier/ai-help" className="fixed bottom-5 right-5 z-40 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/20">AI help ✦</Link>
  </>;
}
