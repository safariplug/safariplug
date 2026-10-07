import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const product = String(url.searchParams.get("product") || "");
  const provider = String(url.searchParams.get("provider") || "");
  const productRef = String(url.searchParams.get("ref") || "");
  if (!["hotel","activity","transfer"].includes(product) || !productRef) {
    return NextResponse.json({ error: "product and ref are required." }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("traveler_reviews")
    .select("id,rating,product_name")
    .eq("product_type", product)
    .eq("product_ref", productRef)
    .eq("moderation_status", "approved")
    .eq("verified_booking", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (provider) query = query.eq("provider", provider);

  const { data: reviews, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = reviews || [];
  if (!rows.length) return NextResponse.json({ count: 0, averageRating: null, firstPhotoUrl: null, productName: null });

  const ids = rows.map((row:any) => String(row.id));
  const { data: media } = await supabaseAdmin
    .from("traveler_review_media")
    .select("review_id,storage_path")
    .in("review_id", ids)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: true })
    .limit(1);

  let firstPhotoUrl: string | null = null;
  const storagePath = media?.[0]?.storage_path ? String(media[0].storage_path) : "";
  if (storagePath) {
    const { data: signed } = await supabaseAdmin.storage.from("traveler-review-media").createSignedUrl(storagePath, 900);
    firstPhotoUrl = signed?.signedUrl || null;
  }

  const averageRating = rows.reduce((sum:any,row:any)=>sum+Number(row.rating||0),0)/rows.length;
  return NextResponse.json({
    count: rows.length,
    averageRating: Number(averageRating.toFixed(1)),
    firstPhotoUrl,
    productName: rows.find((row:any)=>row.product_name)?.product_name || null,
  });
}
