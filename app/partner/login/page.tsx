import { redirect } from "next/navigation";

export default function PartnerLoginCompatibilityPage() {
  redirect("/login?as=partner&next=%2Fpartner%2Fdashboard");
}
