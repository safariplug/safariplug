import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeDriverProviders } from "@/lib/integrations/drivers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateDriverStatus } from "./actions";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "active" || status === "verified" || status === "compliant") return "text-emerald-400";
  if (status === "rejected" || status === "suspended" || status === "expired") return "text-red-400";
  return "text-amber-400";
}

export default async function DriverMarketplacePage() {
  await requireAdmin();
  const [providers, driverResult] = await Promise.all([
    describeDriverProviders(),
    supabaseAdmin
      .from("driver_profiles")
      .select("id,display_name,provider_type,service_city,service_country,service_status,verification_state,driving_license_compliance_status,vehicles(id,status,registration_compliance_status,insurance_compliance_status)")
      .order("created_at", { ascending: false }),
  ]);

  if (driverResult.error) throw new Error(`Failed to load drivers: ${driverResult.error.message}`);

  const drivers = (driverResult.data ?? []).map((driver) => {
    const vehicles = Array.isArray(driver.vehicles) ? driver.vehicles : [];
    const eligibleVehicle = vehicles.some(
      (vehicle) =>
        vehicle.status === "active" &&
        vehicle.registration_compliance_status === "compliant" &&
        vehicle.insurance_compliance_status === "compliant",
    );
    const activationReady =
      driver.verification_state === "verified" &&
      driver.driving_license_compliance_status === "compliant" &&
      eligibleVehicle;
    return { ...driver, vehicleCount: vehicles.length, eligibleVehicle, activationReady };
  });

  const active = drivers.filter((driver) => driver.service_status === "active").length;
  const verified = drivers.filter((driver) => driver.verification_state === "verified").length;
  const ready = drivers.filter((driver) => driver.activationReady).length;

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">
            ← Command Center
          </Link>
          <Link href="/admin/integrations/drivers/document-verification" className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-400 hover:text-white">
            Open document verification →
          </Link>
        </div>

        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">Driver operations</p>
          <h1 className="mt-2 text-3xl font-extrabold">Verification, compliance & activation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            This is the operational control surface for drivers. A driver can only be activated after verified identity, compliant license, and an active vehicle with compliant registration and insurance. The database enforces the same rules server-side.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          {[
            ["Driver records", drivers.length],
            ["Verified", verified],
            ["Activation ready", ready],
            ["Active", active],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
              <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
            </div>
          ))}
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-zinc-900/60 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="p-4">Driver</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Verification</th>
                <th className="p-4">License</th>
                <th className="p-4">Vehicles</th>
                <th className="p-4">Service</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-t border-zinc-900 align-top">
                  <td className="p-4">
                    <div className="font-semibold text-zinc-100">{driver.display_name}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {driver.service_city ?? ""}{driver.service_country ? `, ${driver.service_country}` : ""}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-zinc-400">{driver.provider_type}</td>
                  <td className={`p-4 font-semibold ${statusClass(driver.verification_state)}`}>
                    {driver.verification_state}
                  </td>
                  <td className={`p-4 font-semibold ${statusClass(driver.driving_license_compliance_status ?? "missing")}`}>
                    {driver.driving_license_compliance_status ?? "missing"}
                  </td>
                  <td className="p-4">
                    <div className="text-zinc-300">{driver.vehicleCount} record{driver.vehicleCount === 1 ? "" : "s"}</div>
                    <div className={`mt-1 text-xs font-semibold ${driver.eligibleVehicle ? "text-emerald-400" : "text-amber-400"}`}>
                      {driver.eligibleVehicle ? "activation-ready vehicle" : "no compliant active vehicle"}
                    </div>
                  </td>
                  <td className={`p-4 font-semibold ${statusClass(driver.service_status)}`}>{driver.service_status}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {driver.service_status !== "active" ? (
                        <form action={updateDriverStatus}>
                          <input type="hidden" name="driver_id" value={driver.id} />
                          <input type="hidden" name="service_status" value="active" />
                          <button
                            type="submit"
                            disabled={!driver.activationReady}
                            className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-300 enabled:hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                            title={!driver.activationReady ? "Verification, license compliance, and a compliant active vehicle are required." : "Activate driver"}
                          >
                            Activate
                          </button>
                        </form>
                      ) : (
                        <form action={updateDriverStatus}>
                          <input type="hidden" name="driver_id" value={driver.id} />
                          <input type="hidden" name="service_status" value="inactive" />
                          <button type="submit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900">Deactivate</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!drivers.length ? (
                <tr><td colSpan={7} className="p-12 text-center text-zinc-600">No driver applications have been submitted yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
          <strong className="text-white">Safety gate:</strong> the UI disables activation when requirements are incomplete, and the server/database independently reject invalid activation attempts. AI document approval alone never makes a driver bookable.
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <tr><th className="p-4">Provider</th><th className="p-4">Status</th><th className="p-4">Configured</th><th className="p-4">Contract</th><th className="p-4">Last error</th></tr>
            </thead>
            <tbody>
              {providers.map((row) => (
                <tr key={row.key} className="border-t border-zinc-900">
                  <td className="p-4 text-zinc-200">{row.name}<div className="font-mono text-[10px] text-zinc-500">{row.key}</div></td>
                  <td className="p-4 text-amber-400">{row.status}</td>
                  <td className="p-4 text-zinc-400">{row.configured ? "yes" : "no"}</td>
                  <td className="p-4 text-zinc-400">{row.contract_implemented ? "implemented" : "none"}</td>
                  <td className="max-w-sm p-4 text-zinc-500">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
