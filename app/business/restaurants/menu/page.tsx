import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MenuManager from "@/components/restaurants/MenuManager";

export default async function RestaurantMenuPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const { data: supplier } = await supabaseAdmin
    .from("supplier_accounts")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!supplier?.business_id) redirect("/supplier");
  return <MenuManager businessId={supplier.business_id} />;
}
