import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getArticle(slug: string) {
  const { data } = await supabaseAdmin
    .from("journal_articles")
    .select("id, title, slug, excerpt, body, meta_title, meta_description, image_url, category, city, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Story not found | SafariPlug Journal" };

  return {
    title: article.meta_title || article.title,
    description: article.meta_description || article.excerpt || undefined,
    alternates: { canonical: `https://safariplug.com/journal/${article.slug}` },
    openGraph: {
      title: article.meta_title || article.title,
      description: article.meta_description || article.excerpt || undefined,
      url: `https://safariplug.com/journal/${article.slug}`,
      images: article.image_url ? [article.image_url] : undefined,
      type: "article",
      publishedTime: article.published_at || undefined,
    },
  };
}

export default async function JournalArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const paragraphs = article.body.split(/\n\s*\n/).map((part: string) => part.trim()).filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description || article.excerpt || undefined,
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.published_at || undefined,
    mainEntityOfPage: `https://safariplug.com/journal/${article.slug}`,
    publisher: { "@type": "Organization", name: "SafariPlug", url: "https://safariplug.com" },
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-4xl px-5 py-12 md:px-8 md:py-20">
        <Link href="/journal" className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">← SafariPlug Journal</Link>
        <header className="mt-12 max-w-3xl">
          <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-widest text-amber-300/80">
            {article.category && <span>{article.category}</span>}
            {article.city && <span>· {article.city}</span>}
          </div>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-6xl">{article.title}</h1>
          {article.excerpt && <p className="mt-6 text-lg leading-8 text-zinc-400">{article.excerpt}</p>}
          {article.published_at && <time dateTime={article.published_at} className="mt-6 block font-mono text-[9px] uppercase tracking-widest text-zinc-600">Published {new Date(article.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>}
        </header>

        {article.image_url && <img src={article.image_url} alt="" className="mt-10 aspect-[16/9] w-full rounded-3xl object-cover" />}

        <div className="prose prose-invert mt-12 max-w-none prose-p:text-zinc-300 prose-p:leading-8 prose-headings:text-white prose-a:text-amber-300">
          {paragraphs.map((paragraph: string, index: number) => <p key={index}>{paragraph}</p>)}
        </div>

        <footer className="mt-14 border-t border-white/10 pt-8">
          <Link href="/events" className="font-mono text-[10px] uppercase tracking-widest text-amber-300">Explore events on SafariPlug →</Link>
        </footer>
      </article>
    </main>
  );
}
