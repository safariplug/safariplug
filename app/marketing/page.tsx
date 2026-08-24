import { supabaseAdmin } from "@/lib/supabase-admin";

type MarketingPost = {
  id: number;
  event_name: string;
  city: string;
  platform: string;
  draft_content: string;
  image_url: string | null;
  video_url: string | null;
  external_url: string | null;
  published_at: string | null;
};

export default async function MarketingPage() {

  const { data } = await supabaseAdmin
    .from("marketing_drafts")
    .select(`
      id,
      event_name,
      city,
      platform,
      draft_content,
      image_url,
      video_url,
      external_url,
      published_at
    `)
    .eq("publish_status", "published")
    .order("published_at", {
      ascending: false,
    });


  const posts = (data || []) as MarketingPost[];


  return (
    <main className="min-h-screen bg-[#f7f5f0] px-6 py-10 text-slate-950">

      <div className="mx-auto max-w-6xl">

        <h1 className="text-4xl font-black">
          SafariPlug Marketing
        </h1>

        <p className="mt-3 text-slate-500">
          Discover what SafariPlug is sharing across East Africa.
        </p>


        <div className="mt-10 grid gap-8 md:grid-cols-2">


          {posts.map((post) => (

            <article
              key={post.id}
              className="overflow-hidden rounded-3xl bg-white shadow-sm"
            >


              {post.image_url && (
                <img
                  src={post.image_url}
                  alt={post.event_name}
                  className="h-72 w-full object-cover"
                />
              )}


              {post.video_url && (
                <video
                  controls
                  className="h-72 w-full object-cover"
                >
                  <source src={post.video_url} />
                </video>
              )}



              <div className="p-6">


                <div className="flex items-center justify-between">

                  <h2 className="text-xl font-black">
                    {post.event_name}
                  </h2>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">
                    {post.platform}
                  </span>

                </div>


                <p className="mt-2 text-sm text-slate-500">
                  {post.city}
                </p>



                <div className="mt-5 whitespace-pre-wrap text-sm leading-7">
                  {post.draft_content}
                </div>



                {post.published_at && (
                  <p className="mt-5 text-xs text-slate-400">
                    Published {new Date(post.published_at).toLocaleDateString()}
                  </p>
                )}



                {post.external_url && (
                  <a
                    href={post.external_url}
                    target="_blank"
                    className="mt-5 inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
                  >
                    View Experience
                  </a>
                )}


              </div>


            </article>

          ))}


        </div>


      </div>

    </main>
  );
}