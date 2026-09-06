import Concierge from "./Concierge";
import TravelerNav from "@/components/TravelerNav";

export const dynamic = "force-dynamic";

export default async function ConciergePage({ searchParams }: { searchParams: Promise<{ tripId?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <TravelerNav />
      <Concierge tripId={params.tripId} />
    </>
  );
}
