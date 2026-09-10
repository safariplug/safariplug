import RestaurantOrdering from "@/components/restaurants/RestaurantOrdering";

export default async function RestaurantPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <RestaurantOrdering businessId={businessId} />;
}
