import Concierge from "./Concierge";
import TravelerNav from "@/components/TravelerNav";

export const dynamic = "force-dynamic";

export default function ConciergePage() {
  return (
    <>
      <TravelerNav />
      <Concierge />
    </>
  );
}
