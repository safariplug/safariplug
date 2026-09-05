import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function badge(status: string) {
  if (status === "accepted") return "text-emerald-400";
  if (status === "rejected") return "text-red-400";
  return "text-amber-400";
}

export default async function DriverDocumentVerificationPage() {
  await requireAdmin();
  const { data: evidence, error } = await supabaseAdmin.from("verification_evidence").select("id, case_id, evidence_type, status, provider, submitted_at, reviewed_at, metadata").in("evidence_type", ["license", "vehicle_registration", "insurance"]).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Failed to load AI document verification: ${error.message}`);

  const caseIds = [...new Set((evidence ?? []).map((row) => row.case_id))];
  const { data: cases } = caseIds.length ? await supabaseAdmin.from("verification_cases").select("id, subject_id").in("id", caseIds) : { data: [] as { id: string; subject_id: string }[] };
  const driverIds = [...new Set((cases ?? []).map((row) => row.subject_id))];
  const { data: drivers } = driverIds.length ? await supabaseAdmin.from("driver_profiles").select("id, display_name, service_city, service_country").in("id", driverIds) : { data: [] as { id: string; display_name: string; service_city: string | null; service_country: string | null }[] };
  const caseDriver = new Map((cases ?? []).map((row) => [row.id, row.subject_id]));
  const driverMap = new Map((drivers ?? []).map((row) => [row.id, row]));
  const rows = (evidence ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const driver = driverMap.get(caseDriver.get(row.case_id) ?? "");
    return { ...row, driver, decision: String(metadata.decision ?? "review"), confidence: Number(metadata.confidence ?? 0), reasons: Array.isArray(metadata.reasons) ? metadata.reasons.map(String) : [] };
  });
  const autoApproved = rows.filter((row) => row.status === "accepted" && row.provider === "ai_document_verification").length;
  const review = rows.filter((row) => row.status === "submitted").length;

  return <main className="min-h-screen bg-[#070708] text-white"><header className="border-b border-zinc-800/80"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5"><div><Link href="/admin/integrations/drivers" className="text-sm text-zinc-500 hover:text-white">← Driver integrations</Link><h1 className="mt-2 text-3xl font-black">AI document verification</h1></div><div className="text-right text-xs text-zinc-500"><div>{autoApproved} AI-approved documents</div><div>{review} awaiting review</div></div></div></header><section className="mx-auto max-w-6xl px-6 py-10"><div className="rounded-3xl border border-[#c9a86a]/20 bg-[#c9a86a]/5 p-5 text-sm leading-6 text-zinc-300"><strong className="text-white">Important:</strong> AI approval means the document passed SafariPlug's automated visual/consistency checks. It is not a government registry validation and it does not make the driver bookable. Driver approval still requires all required compliance controls and mandatory live face/liveness verification.</div><div className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"><table className="w-full text-left text-sm"><thead className="bg-zinc-900/60 font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="px-5 py-4">Driver</th><th className="px-5 py-4">Document</th><th className="px-5 py-4">AI decision</th><th className="px-5 py-4">Confidence</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Reasons</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-zinc-900 align-top"><td className="px-5 py-4"><div className="font-semibold">{row.driver?.display_name ?? "Unknown driver"}</div><div className="mt-1 text-xs text-zinc-600">{row.driver?.service_city ?? ""}{row.driver?.service_country ? `, ${row.driver.service_country}` : ""}</div></td><td className="px-5 py-4 font-medium">{row.evidence_type.replaceAll("_", " ")}</td><td className={`px-5 py-4 font-semibold ${badge(row.decision)}`}>{row.decision}</td><td className="px-5 py-4 text-zinc-300">{Math.round(row.confidence * 100)}%</td><td className={`px-5 py-4 font-semibold ${badge(row.status)}`}>{row.status}</td><td className="max-w-md px-5 py-4 text-xs leading-5 text-zinc-500">{row.reasons.length ? row.reasons.join(" · ") : "No reason recorded"}</td></tr>)}{!rows.length ? <tr><td colSpan={6} className="px-5 py-12 text-center text-zinc-600">No driver documents have been submitted for AI verification yet.</td></tr> : null}</tbody></table></div></section></main>;
}
