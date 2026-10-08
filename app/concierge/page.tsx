import Concierge from "./Concierge";
import TravelerNav from "@/components/TravelerNav";
import MarketplaceViewTracker from "@/components/MarketplaceViewTracker";

export const dynamic = "force-dynamic";

export default async function ConciergePage({ searchParams }: { searchParams: Promise<{ tripId?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <MarketplaceViewTracker surface="amani" />
      <TravelerNav />
      <Concierge tripId={params.tripId} />
    </>
  );
}
