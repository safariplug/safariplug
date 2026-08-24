import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  approveMarketingDraft,
  rejectMarketingDraft,
} from "./actions/approve";
import { publishMarketingDraft } from "./actions/publish";

type Draft = {
  id: number;
  created_at: string;
  event_id: string | null;
  event_name: string;
  city: string;
  platform: string;
  content_type: string;
  draft_content: string;
  status: string;
  publish_status: string;
  image_url: string | null;
  video_url: string | null;
  external_url: string | null;
  published_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
};

function statusStyle(status: string) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700";
  }

  return "bg-orange-100 text-orange-700";
}

function publishStatusStyle(status: string) {
  if (status === "ready_to_publish") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default async function MarketingPage() {

  const { data } = await supabaseAdmin
    .from("marketing_drafts")
    .select(`
      id,
      created_at,
      event_id,
      event_name,
      city,
      platform,
      content_type,
      draft_content,
      status,
      publish_status,
      image_url,
      video_url,
      external_url
    `)
    .order("created_at", {
      ascending: false,
    });

  const drafts = (data || []) as Draft[];

  const pending = drafts.filter(
    (draft) => draft.status === "draft"
  );

  const approved = drafts.filter(
    (draft) => draft.status === "approved"
  );

  const rejected = drafts.filter(
    (draft) => draft.status === "rejected"
  );

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-6 py-10 text-slate-950">

      <div className="mx-auto max-w-7xl">

        <h1 className="text-4xl font-black">
          Marketing Studio
        </h1>

        <p className="mt-3 text-slate-500">
          Review AI-generated marketing drafts before publishing.
        </p>


        <div className="mt-6 flex flex-wrap gap-3">

          <Link
            href="/admin/marketing"
            className="rounded-full bg-slate-950 px-5 py-2 text-xs font-black text-white"
          >
            All ({drafts.length})
          </Link>

          <Link
            href="/admin/marketing?status=draft"
            className="rounded-full bg-orange-500 px-5 py-2 text-xs font-black text-white"
          >
            Needs Review ({pending.length})
          </Link>

          <Link
            href="/admin/marketing?status=approved"
            className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-black text-white"
          >
            Approved ({approved.length})
          </Link>

          <Link
            href="/admin/marketing?status=rejected"
            className="rounded-full bg-red-600 px-5 py-2 text-xs font-black text-white"
          >
            Rejected ({rejected.length})
          </Link>

        </div>


        <div className="mt-10 space-y-6">

          {drafts.map((draft) => (

            <article
              key={draft.id}
              className="rounded-3xl bg-white p-6 shadow-sm"
            >

              <div className="flex flex-wrap justify-between gap-4">

                <div>
                  <h2 className="text-xl font-black">
                    {draft.event_name}
                  </h2>

                  <p className="text-sm text-slate-500">
                    {draft.city} · {draft.platform}
                  </p>
                </div>


                <div className="flex gap-2">

                  <span
                    className={`rounded-full px-4 py-2 text-xs font-black ${statusStyle(
                      draft.status
                    )}`}
                  >
                    {draft.status}
                  </span>


                  <span
                    className={`rounded-full px-4 py-2 text-xs font-black ${publishStatusStyle(
                      draft.publish_status
                    )}`}
                  >
                    {draft.publish_status}
                  </span>

                </div>

              </div>


              <div className="mt-5 rounded-2xl bg-slate-50 p-5">

                <p className="whitespace-pre-wrap text-sm leading-7">
                  {draft.draft_content}
                </p>

              </div>
{draft.publish_status === "published" && (
  <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">

    <h3 className="text-sm font-black text-blue-800">
      Publishing History
    </h3>

    <div className="mt-3 space-y-1 text-sm text-slate-700">

      <p>
        Published:
        {" "}
        {draft.published_at
          ? new Date(draft.published_at).toLocaleString()
          : "Unknown"}
      </p>

      <p>
        Approved by:
        {" "}
        {draft.approved_by || "Unknown"}
      </p>

      {draft.approved_at && (
        <p>
          Approved:
          {" "}
          {new Date(draft.approved_at).toLocaleString()}
        </p>
      )}

    </div>

  </div>
)}


              {draft.status === "draft" && (

                <div className="mt-5 flex gap-3">

                  <form action={approveMarketingDraft.bind(null, draft.id)}>
                    <button
                      className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
                    >
                      Approve
                    </button>
<div className="mt-6 rounded-2xl bg-slate-50 p-5">

  <h3 className="font-black">
    Media Attachments
  </h3>

  <p className="mt-1 text-sm text-slate-500">
    Add image, video, or experience link before publishing.
  </p>

  <div className="mt-4 space-y-3">

    <input
      placeholder="Image URL"
      className="w-full rounded-xl border px-4 py-3"
      defaultValue={draft.image_url ?? ""}
    />

    <input
      placeholder="Video URL"
      className="w-full rounded-xl border px-4 py-3"
      defaultValue={draft.video_url ?? ""}
    />

    <input
      placeholder="Experience URL"
      className="w-full rounded-xl border px-4 py-3"
      defaultValue={draft.external_url ?? ""}
    />

  </div>

</div>
{draft.publish_status === "ready_to_publish" && (
  <form
    action={publishMarketingDraft.bind(
      null,
      draft.id
    )}
  >
    <button
      type="submit"
      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
    >
      Publish
    </button>
  </form>
)}
                  </form>


                  <form action={rejectMarketingDraft.bind(null, draft.id)}>
                    <button
                      className="rounded-xl border border-red-300 px-5 py-3 text-sm font-black text-red-600"
                    >
                      Reject
                    </button>
                  </form>

                </div>

              )}
{draft.publish_status === "ready_to_publish" && (
  <div className="mt-5">

    <form action={publishMarketingDraft.bind(null, draft.id)}>
      <button
        type="submit"
        className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-600"
      >
        Publish
      </button>
    </form>

  </div>
)}

            </article>

          ))}

        </div>

      </div>

    </main>
  );
}