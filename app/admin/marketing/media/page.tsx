import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateMarketingMedia } from "./actions";
import { generateMarketingVideo, refreshMarketingVideo } from "./video-actions";
import { publishMarketingDraft } from "../actions/publish";

type MediaDraft = {
  id: number;
  event_name: string;
  city: string;
  platform: string;
  image_url: string | null;
  video_url: string | null;
  video_job_id: string | null;
  video_status: string | null;
  video_error: string | null;
  external_url: string | null;
  publish_status: string;
  metricool_post_id: string | null;
  metricool_status: string | null;
  publish_error: string | null;
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
      video_job_id,
      video_status,
      video_error,
      external_url,
      publish_status,
      metricool_post_id,
      metricool_status,
      publish_error
    `)
    .eq("status", "approved")
    .order("id", { ascending: false });

  const drafts = (data || []) as MediaDraft[];

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/marketing" className="text-sm font-black text-blue-600">
          ← Back to Marketing Studio
        </Link>

        <h1 className="mt-6 text-4xl font-black">Marketing Media Queue</h1>
        <p className="mt-3 text-slate-500">
          Attach photos, generate short-form video, and send approved campaigns to Metricool.
        </p>

        <div className="mt-10 space-y-8">
          {drafts.map((draft) => (
            <article key={draft.id} className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{draft.event_name}</h2>
                  <p className="text-sm text-slate-500">{draft.city} · {draft.platform}</p>
                </div>
                <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-700">
                  {draft.publish_status}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Image</strong>
                  <p className="mt-2 break-all text-sm">{draft.image_url ?? "No image attached"}</p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Video</strong>
                  <p className="mt-2 break-all text-sm">{draft.video_url ?? "No video attached"}</p>
                  {draft.video_status && (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Generation: {draft.video_status}
                    </p>
                  )}
                  {draft.video_error && (
                    <p className="mt-2 text-xs font-semibold text-red-600">{draft.video_error}</p>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <strong>Experience Link</strong>
                  <p className="mt-2 break-all text-sm">{draft.external_url ?? "No link attached"}</p>
                </div>
              </div>

              {(draft.platform === "instagram" || draft.platform === "tiktok") && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <form action={generateMarketingVideo}>
                    <input type="hidden" name="id" value={draft.id} />
                    <button type="submit" className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-black">
                      {draft.video_job_id ? "Regenerate Video" : "Generate Video"}
                    </button>
                  </form>

                  {draft.video_job_id && !draft.video_url && (
                    <form action={refreshMarketingVideo}>
                      <input type="hidden" name="id" value={draft.id} />
                      <button type="submit" className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white">
                        Check / Render Video
                      </button>
                    </form>
                  )}

                  {!draft.metricool_post_id && draft.publish_status === "ready_to_publish" && (
                    <form action={publishMarketingDraft}>
                      <input type="hidden" name="id" value={draft.id} />
                      <button type="submit" className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-black">
                        Send to Metricool
                      </button>
                    </form>
                  )}
                </div>
              )}

              {draft.metricool_status && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <strong>Metricool:</strong> {draft.metricool_status}
                  {draft.metricool_post_id ? ` · Post ${draft.metricool_post_id}` : ""}
                </div>
              )}

              {draft.publish_error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                  Metricool error: {draft.publish_error}
                </div>
              )}

              <form action={updateMarketingMedia} className="mt-6 space-y-3">
                <input type="hidden" name="id" value={draft.id} />
                <input name="image_url" placeholder="Image URL" defaultValue={draft.image_url ?? ""} className="w-full rounded-xl border px-4 py-3" />
                <input name="video_url" placeholder="Video URL" defaultValue={draft.video_url ?? ""} className="w-full rounded-xl border px-4 py-3" />
                <input name="external_url" placeholder="Experience URL" defaultValue={draft.external_url ?? ""} className="w-full rounded-xl border px-4 py-3" />
                <button type="submit" className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white">
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
