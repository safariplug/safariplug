import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The original supplier kitchen page used a legacy mutation endpoint that
 * bypassed the canonical restaurant order state machine. Keep the old URL
 * working while routing operators to the guarded restaurant workspace.
 */
export default function SupplierRestaurantOrdersPage() {
  redirect("/business/restaurants/orders");
}
