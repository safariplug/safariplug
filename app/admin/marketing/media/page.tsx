import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateMarketingMedia } from "./actions";

type MediaDraft = {
  id: number;
  event_name: string;
  city: string;
  platform: string;
  image_url: string | null;
  video_url: string | null;
  external_url: string | null;
  publish_status: string;
};

export default async function MarketingMediaPage() {
  const { data } = await supabaseAdmin
    .from("marketing_drafts")
    .select(`
      id,
      event_name,
      city,
      platform,
      image_url,
      video_url,
      external_url,
      publish_status
    `)
    .eq("status", "approved")
    .order("id", {
      ascending: false,
    });

  const drafts = (data || []) as MediaDraft[];

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-6 py-10 text-slate-950">

      <div className="mx-auto max-w-6xl">

        <Link
          href="/admin/marketing"
          className="text-sm font-black text-blue-600"
        >
          ← Back to Marketing Studio
        </Link>

        <h1 className="mt-6 text-4xl font-black">
          Marketing Media Queue
        </h1>

        <p className="mt-3 text-slate-500">
          Attach photos, videos and booking links before publishing.
        </p>


        <div className="mt-10 space-y-8">

          {drafts.map((draft) => (

            <article
              key={draft.id}
              className="rounded-3xl bg-white p-6 shadow-sm"
            >

              <div className="flex justify-between gap-4">

                <div>
                  <h2 className="text-xl font-black">
                    {draft.event_name}
                  </h2>

                  <p className="text-sm text-slate-500">
                    {draft.city} · {draft.platform}
                  </p>
                </div>

                <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-700">
                  {draft.publish_status}
                </span>

              </div>


              <div className="mt-6 grid gap-4 md:grid-cols-3">

                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Image</strong>

                  <p className="mt-2 break-all text-sm">
                    {draft.image_url ?? "No image attached"}
                  </p>
                </div>


                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Video</strong>

                  <p className="mt-2 break-all text-sm">
                    {draft.video_url ?? "No video attached"}
                  </p>
                </div>


                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Experience Link</strong>

                  <p className="mt-2 break-all text-sm">
                    {draft.external_url ?? "No link attached"}
                  </p>
                </div>

              </div>


              <form
                action={updateMarketingMedia.bind(null, draft.id)}
                className="mt-6 space-y-3"
              >

                <input
                  name="image_url"
                  placeholder="Image URL"
                  defaultValue={draft.image_url ?? ""}
                  className="w-full rounded-xl border px-4 py-3"
                />

                <input
                  name="video_url"
                  placeholder="Video URL"
                  defaultValue={draft.video_url ?? ""}
                  className="w-full rounded-xl border px-4 py-3"
                />

                <input
                  name="external_url"
                  placeholder="Experience URL"
                  defaultValue={draft.external_url ?? ""}
                  className="w-full rounded-xl border px-4 py-3"
                />


                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white"
                >
                  Save Media
                </button>

              </form>


            </article>

          ))}

        </div>

      </div>

    </main>
  );
}