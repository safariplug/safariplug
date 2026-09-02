import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = {
  title: "SafariPlug Journal | Things to Do, Travel & Events in East Africa",
  description: "Discover what to do, where to go and what's happening across East Africa with SafariPlug Journal.",
  alternates: { canonical: "https://safariplug.com/journal" },
  openGraph: {
    title: "SafariPlug Journal",
    description: "Travel guides, event stories and ideas for discovering East Africa.",
    url: "https://safariplug.com/journal",
    type: "website",
  },
};

export default async function JournalPage() {
  const { data: articles } = await supabaseAdmin
    .from("journal_articles")
    .select("id, title, slug, excerpt, image_url, category, city, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <header className="max-w-3xl">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300">SafariPlug</Link>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Journal / East Africa</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-[-0.05em] md:text-7xl">Discover more.<span className="text-amber-300">.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">Stories, guides and timely ideas for finding the best things to do, places to go and experiences to discover across East Africa.</p>
        </header>

        {articles?.length ? (
          <section className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link key={article.id} href={`/journal/${article.slug}`} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-1 hover:border-amber-300/30">
                {article.image_url ? (
                  <img src={article.image_url} alt="" className="aspect-[16/10] w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.02]" />
                ) : (
                  <div className="aspect-[16/10] w-full bg-gradient-to-br from-amber-300/20 via-white/[0.03] to-transparent" />
                )}
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-widest text-amber-300/80">
                    {article.category && <span>{article.category}</span>}
                    {article.city && <span>· {article.city}</span>}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold leading-tight group-hover:text-amber-200">{article.title}</h2>
                  {article.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-500">{article.excerpt}</p>}
                  <div className="mt-5 font-mono text-[9px] uppercase tracking-widest text-zinc-600">Read story →</div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <div className="mt-14 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Journal coming soon</p>
            <p className="mt-3 text-zinc-400">SafariPlug stories will appear here after they pass human editorial approval.</p>
          </div>
        )}
      </div>
    </main>
  );
}
