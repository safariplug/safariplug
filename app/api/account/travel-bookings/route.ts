import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Product = "hotel" | "transfer" | "activity";

type LedgerRow = {
  id: string;
  prepared_booking_id: string;
  provider_booking_reference: string | null;
  customer_currency?: string | null;
  customer_retail_amount?: number | null;
  retail_amount?: number | null;
  payment_status: string | null;
  booking_status: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function labelFor(product: Product, row: LedgerRow) {
  const metadata = row.metadata || {};
  if (product === "hotel") return String(metadata.hotelName || "Hotel stay");
  if (product === "activity") {
    const activity = metadata.activity && typeof metadata.activity === "object"
      ? metadata.activity as Record<string, unknown>
      : {};
    return String(activity.name || "Activity booking");
  }
  const route = metadata.route && typeof metadata.route === "object"
    ? metadata.route as Record<string, unknown>
    : {};
  const from = route.from && typeof route.from === "object" ? route.from as Record<string, unknown> : {};
  const to = route.to && typeof route.to === "object" ? route.to as Record<string, unknown> : {};
  return [String(from.code || ""), String(to.code || "")].filter(Boolean).join(" → ") || "Transfer booking";
}

async function getUser(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error && data.user && !data.user.is_anonymous && (data.user.email_confirmed_at || data.user.phone_confirmed_at)) {
      return data.user;
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !(user.email_confirmed_at || user.phone_confirmed_at)) return null;
  return user;
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const [hotels, transfers, activities] = await Promise.all([
    supabaseAdmin.from("hotel_booking_pricing_ledger")
      .select("id,prepared_booking_id,provider_booking_reference,customer_currency,customer_retail_amount,retail_amount,payment_status,booking_status,created_at,metadata")
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("transfer_booking_pricing_ledger")
      .select("id,prepared_booking_id,provider_booking_reference,customer_currency,retail_amount,payment_status,booking_status,created_at,metadata")
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("activity_booking_pricing_ledger")
      .select("id,prepared_booking_id,provider_booking_reference,customer_currency,retail_amount,payment_status,booking_status,created_at,metadata")
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const sourceErrors = [hotels.error, transfers.error, activities.error].filter(Boolean);
  if (sourceErrors.length) {
    console.error("Unable to load traveler travel bookings", sourceErrors);
    return NextResponse.json({ error: "Unable to load travel bookings." }, { status: 500 });
  }

  const groups: { product: Product; rows: LedgerRow[] }[] = [
    { product: "hotel", rows: (hotels.data || []) as LedgerRow[] },
    { product: "transfer", rows: (transfers.data || []) as LedgerRow[] },
    { product: "activity", rows: (activities.data || []) as LedgerRow[] },
  ];

  const ids = groups.flatMap(group => group.rows.map(row => row.id));
  const { data: reviews, error: reviewsError } = ids.length
    ? await supabaseAdmin
        .from("travel_refund_reviews")
        .select("product,ledger_id,status,resolution,updated_at")
        .in("ledger_id", ids)
        .in("product", ["hotel", "transfer", "activity"])
    : { data: [], error: null };
  if (reviewsError) console.error("Unable to load travel refund review status", reviewsError);

  const reviewMap = new Map(
    (reviews || []).map(review => [`${review.product}:${review.ledger_id}`, review])
  );

  const bookings = groups.flatMap(group =>
    group.rows.map(row => ({
      id: row.id,
      product: group.product,
      bookingId: row.prepared_booking_id,
      label: labelFor(group.product, row),
      providerReference: row.provider_booking_reference,
      currency: row.customer_currency || "KES",
      amount: Number(row.customer_retail_amount ?? row.retail_amount ?? 0),
      paymentStatus: row.payment_status || "pending",
      bookingStatus: row.booking_status || "pending",
      createdAt: row.created_at,
      refundReview: reviewMap.get(`${group.product}:${row.id}`) || null,
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ bookings });
}
