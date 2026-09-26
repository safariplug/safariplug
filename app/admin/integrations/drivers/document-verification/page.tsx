import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { reviewDriverDocument } from "./actions";

export const dynamic = "force-dynamic";

function badge(status: string) {
  if (status === "accepted") return "text-emerald-400";
  if (status === "rejected") return "text-red-400";
  return "text-amber-400";
}

export default async function DriverDocumentVerificationPage() {
  await requireAdmin();
  const { data: evidence, error } = await supabaseAdmin.from("verification_evidence").select("id, case_id, evidence_type, status, provider, storage_ref, submitted_at, reviewed_at, rejection_reason, metadata").in("evidence_type", ["license", "vehicle_registration", "insurance"]).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Failed to load driver document verification: ${error.message}`);

  const caseIds = [...new Set((evidence ?? []).map((row) => row.case_id))];
  const { data: cases } = caseIds.length ? await supabaseAdmin.from("verification_cases").select("id, subject_id").in("id", caseIds) : { data: [] as { id: string; subject_id: string }[] };
  const driverIds = [...new Set((cases ?? []).map((row) => row.subject_id))];
  const { data: drivers } = driverIds.length ? await supabaseAdmin.from("driver_profiles").select("id, display_name, service_city, service_country").in("id", driverIds) : { data: [] as { id: string; display_name: string; service_city: string | null; service_country: string | null }[] };
  const caseDriver = new Map((cases ?? []).map((row) => [row.id, row.subject_id]));
  const driverMap = new Map((drivers ?? []).map((row) => [row.id, row]));
  const rows = await Promise.all((evidence ?? []).map(async (row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const driver = driverMap.get(caseDriver.get(row.case_id) ?? "");
    const signed = row.storage_ref
      ? await supabaseAdmin.storage.from("driver-verification").createSignedUrl(row.storage_ref, 600)
      : null;
    return {
      ...row,
      driver,
      documentUrl: signed?.data?.signedUrl ?? null,
      decision: String(metadata.decision ?? "review"),
      confidence: Number(metadata.confidence ?? 0),
      reasons: Array.isArray(metadata.reasons) ? metadata.reasons.map(String) : [],
    };
  }));
  const autoApproved = rows.filter((row) => row.status === "accepted" && row.provider === "ai_document_verification").length;
  const review = rows.filter((row) => row.status === "submitted").length;

  return <main className="min-h-screen bg-[#070708] text-white"><header className="border-b border-zinc-800/80"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><div><Link href="/admin/integrations/drivers" className="text-sm text-zinc-500 hover:text-white">← Driver integrations</Link><h1 className="mt-2 text-3xl font-black">Driver document review</h1></div><div className="text-right text-xs text-zinc-500"><div>{autoApproved} automatically approved documents</div><div>{review} awaiting review</div></div></div></header><section className="mx-auto max-w-6xl px-6 py-10"><div className="rounded-3xl border border-[#c9a86a]/20 bg-[#c9a86a]/5 p-5 text-sm leading-6 text-zinc-300"><strong className="text-white">Important:</strong> AI approval means the document passed SafariPlug's automated visual/consistency checks. It is not a government registry validation and it does not make the driver bookable. Driver approval still requires all required compliance controls and mandatory live face/liveness verification.</div><div className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"><table className="w-full text-left text-sm"><thead className="bg-zinc-900/60 font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="px-5 py-4">Driver</th><th className="px-5 py-4">Document</th><th className="px-5 py-4">AI decision</th><th className="px-5 py-4">Confidence</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Reasons</th><th className="px-5 py-4">Review</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-zinc-900 align-top"><td className="px-5 py-4"><div className="font-semibold">{row.driver?.display_name ?? "Unknown driver"}</div><div className="mt-1 text-xs text-zinc-600">{row.driver?.service_city ?? ""}{row.driver?.service_country ? `, ${row.driver.service_country}` : ""}</div></td><td className="px-5 py-4 font-medium">{row.evidence_type.replaceAll("_", " ")}</td><td className={`px-5 py-4 font-semibold ${badge(row.decision)}`}>{row.decision}</td><td className="px-5 py-4 text-zinc-300">{Math.round(row.confidence * 100)}%</td><td className={`px-5 py-4 font-semibold ${badge(row.status)}`}>{row.status}</td><td className="max-w-md px-5 py-4 text-xs leading-5 text-zinc-500">{row.rejection_reason || (row.reasons.length ? row.reasons.join(" · ") : "No reason recorded")}</td><td className="px-5 py-4"><div className="flex min-w-[180px] flex-col gap-2">{row.documentUrl ? <a href={row.documentUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-center text-xs font-semibold text-zinc-200 hover:border-amber-400">View document</a> : <span className="text-xs text-red-400">Document unavailable</span>}{row.status === "submitted" ? <><form action={reviewDriverDocument}><input type="hidden" name="evidence_id" value={row.id}/><input type="hidden" name="decision" value="accepted"/><button className="w-full rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10">Approve document</button></form><form action={reviewDriverDocument} className="space-y-2"><input type="hidden" name="evidence_id" value={row.id}/><input type="hidden" name="decision" value="rejected"/><input name="reason" required placeholder="Rejection reason" className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-xs text-white"/><button className="w-full rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">Reject document</button></form></> : <span className="text-xs text-zinc-500">Reviewed</span>}</div></td></tr>)}{!rows.length ? <tr><td colSpan={7} className="px-5 py-12 text-center text-zinc-600">No driver documents have been submitted for AI verification yet.</td></tr> : null}</tbody></table></div></section></main>;
}
