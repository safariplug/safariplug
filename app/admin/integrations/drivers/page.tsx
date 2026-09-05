import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { describeDriverProviders } from "@/lib/integrations/drivers";
import { listAvailabilityAdmin, listDriversAdmin, listVehiclesAdmin } from "@/lib/services/driver-admin";
import { publicMarketplaceSnapshot } from "@/lib/services/drivers";
import { createAvailability, createDriver, createVehicle, updateDriverStatus, activateVehicle } from "./actions";

export const dynamic = "force-dynamic";

const capabilities = [
  "airport_transfer", "hotel_transfer", "long_distance", "city_transfer",
  "child_seat", "wheelchair_accessible", "large_luggage", "premium_vehicle",
] as const;

export default async function DriverMarketplacePage() {
  await requireAdmin();
  const [providers, drivers, vehicles, availability] = await Promise.all([
    describeDriverProviders(),
    listDriversAdmin(),
    listVehiclesAdmin(),
    listAvailabilityAdmin(),
  ]);
  const snapshot = { ...publicMarketplaceSnapshot(), driver_count: drivers.length };

  return (
    <main className="min-h-screen bg-[#050505] p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/admin" className="font-mono text-xs text-amber-400 hover:underline">← Command Center</Link>
        <header className="border-b border-zinc-800 pb-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">Driver marketplace</p>
          <h1 className="mt-2 text-3xl font-extrabold">Operations console</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Real Supabase-backed driver inventory. New drivers remain pending and unverified.
            A driver cannot become bookable until the verification workflow approves the driver.
            No fake inventory is created and no private contact or verification evidence is exposed.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-4">
          {[
            ["Live adapters", snapshot.live_adapters],
            ["Driver records", drivers.length],
            ["Vehicles", vehicles.length],
            ["Availability slots", availability.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
              <p className="mt-2 font-mono text-lg font-bold text-amber-400">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <form action={createDriver} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="font-bold">Add driver</h2>
            <p className="text-xs text-zinc-500">Creates pending + unverified. Verification is a separate workflow.</p>
            <input name="display_name" required placeholder="Display name" className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <select name="provider_type" className="w-full rounded-lg bg-zinc-900 p-2 text-sm">
              <option value="independent_driver">Independent driver</option>
              <option value="safariplug_driver">SafariPlug driver</option>
              <option value="transport_company">Transport company</option>
              <option value="hotel_driver">Hotel driver</option>
              <option value="tour_operator">Tour operator</option>
              <option value="aurelian_driver">Aurelian driver</option>
              <option value="external_driver_provider">External provider</option>
            </select>
            <input name="contact_ref" placeholder="Opaque contact reference (private)" className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="service_city" placeholder="Service city" className="rounded-lg bg-zinc-900 p-2 text-sm" />
              <input name="service_country" placeholder="Country" className="rounded-lg bg-zinc-900 p-2 text-sm" />
            </div>
            <input name="service_airport_code" placeholder="Airport code (optional)" className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
              {capabilities.map((cap) => <label key={cap} className="flex gap-2"><input type="checkbox" name="capability" value={cap} />{cap.replaceAll("_", " ")}</label>)}
            </div>
            <button className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black">Create pending driver</button>
          </form>

          <form action={createVehicle} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="font-bold">Add vehicle</h2>
            <select name="driver_id" required className="w-full rounded-lg bg-zinc-900 p-2 text-sm">
              <option value="">Select driver</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}</option>)}
            </select>
            <input name="category" placeholder="Vehicle category" className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <input name="make_model" placeholder="Make / model" className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input name="passenger_capacity" type="number" min="1" placeholder="Passengers" className="rounded-lg bg-zinc-900 p-2 text-sm" />
              <input name="luggage_capacity" type="number" min="0" placeholder="Luggage" className="rounded-lg bg-zinc-900 p-2 text-sm" />
            </div>
            <p className="text-xs text-zinc-500">Vehicles start as draft. Activate only after the vehicle/provider review is complete.</p>
            <button className="w-full rounded-lg bg-zinc-200 px-4 py-2 text-sm font-bold text-black">Create draft vehicle</button>
          </form>

          <form action={createAvailability} className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="font-bold">Add availability</h2>
            <select name="driver_id" required className="w-full rounded-lg bg-zinc-900 p-2 text-sm">
              <option value="">Select driver</option>
              {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.display_name}</option>)}
            </select>
            <input name="available_on" type="date" required className="w-full rounded-lg bg-zinc-900 p-2 text-sm" />
            <div className="grid grid-cols-2 gap-2"><input name="start_time" type="time" className="rounded-lg bg-zinc-900 p-2 text-sm" /><input name="end_time" type="time" className="rounded-lg bg-zinc-900 p-2 text-sm" /></div>
            <button className="w-full rounded-lg bg-zinc-200 px-4 py-2 text-sm font-bold text-black">Add availability</button>
          </form>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5"><h2 className="font-bold">Driver inventory</h2><p className="mt-1 text-xs text-zinc-500">Only verified + active drivers are eligible for assignment.</p></div>
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="p-4">Driver</th><th className="p-4">Verification</th><th className="p-4">Service</th><th className="p-4">Vehicles</th><th className="p-4">Availability</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead>
            <tbody>
              {drivers.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-zinc-500">No real drivers yet. Add only verified/legitimate inventory.</td></tr> : drivers.map((driver) => {
                const driverVehicles = vehicles.filter((v) => v.driver_id === driver.id);
                const driverAvailability = availability.filter((a) => a.driver_id === driver.id);
                return <tr key={driver.id} className="border-b border-zinc-900">
                  <td className="p-4"><div className="font-semibold">{driver.display_name}</div><div className="font-mono text-[10px] text-zinc-600">{driver.id}</div></td>
                  <td className="p-4"><span className={driver.verification_state === "verified" ? "text-emerald-400" : "text-amber-400"}>{driver.verification_state}</span></td>
                  <td className="p-4 text-zinc-400">{driver.service_area.city || driver.service_area.airport_code || driver.service_area.country || "—"}</td>
                  <td className="p-4 text-zinc-400">{driverVehicles.length}</td><td className="p-4 text-zinc-400">{driverAvailability.length}</td>
                  <td className="p-4 text-zinc-400">{driver.service_status}</td>
                  <td className="p-4"><form action={updateDriverStatus}><input type="hidden" name="driver_id" value={driver.id}/><select name="service_status" defaultValue={driver.service_status} className="rounded bg-zinc-900 p-1 text-xs"><option value="pending">pending</option><option value="active">active</option><option value="inactive">inactive</option><option value="suspended">suspended</option><option value="off_duty">off duty</option></select><button className="ml-2 text-xs text-amber-400 hover:underline">Save</button></form></td>
                </tr>;
              })}
            </tbody>
          </table>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 p-5"><h2 className="font-bold">Vehicle inventory</h2></div>
          <table className="w-full text-left text-sm"><thead className="font-mono text-[10px] uppercase tracking-widest text-zinc-500"><tr><th className="p-4">Vehicle</th><th className="p-4">Driver</th><th className="p-4">Capacity</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>
            {vehicles.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No vehicles yet.</td></tr> : vehicles.map((vehicle) => <tr key={vehicle.id} className="border-b border-zinc-900"><td className="p-4">{vehicle.make_model || vehicle.category || "Unspecified"}</td><td className="p-4 text-zinc-400">{drivers.find((d) => d.id === vehicle.driver_id)?.display_name || vehicle.driver_id}</td><td className="p-4 text-zinc-400">{vehicle.passenger_capacity ?? "—"} pax / {vehicle.luggage_capacity ?? "—"} bags</td><td className="p-4 text-zinc-400">{vehicle.status}</td><td className="p-4">{vehicle.status !== "active" ? <form action={activateVehicle}><input type="hidden" name="vehicle_id" value={vehicle.id}/><button className="text-xs text-amber-400 hover:underline">Activate</button></form> : <span className="text-xs text-emerald-400">active</span>}</td></tr>)}
          </tbody></table>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="font-bold">Provider adapters</h2><p className="mt-1 text-xs text-zinc-500">No external driver inventory is assumed or invented.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{providers.map((row) => <div key={row.key} className="rounded-xl border border-zinc-900 p-4"><div className="font-semibold">{row.name}</div><div className="font-mono text-xs text-zinc-600">{row.key}</div><div className="mt-2 text-xs text-amber-400">{row.status} · {row.contract_implemented ? "contract implemented" : "no live adapter"}</div></div>)}</div>
        </section>
      </div>
    </main>
  );
}
