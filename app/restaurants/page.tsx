import { redirect } from "next/navigation";

export default function RestaurantsPage() {
  redirect("/services?category=restaurants");
}
