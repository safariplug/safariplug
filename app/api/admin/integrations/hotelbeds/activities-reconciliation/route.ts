import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHotelbedsActivityBooking } from "@/lib/integrations/hotelbeds/activities";
import { activityBookingStatus } from "@/lib/integrations/hotelbeds/activity-checkout";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const ledgerId = String(body.ledgerId || "").trim();

    if (!ledgerId) return NextResponse.json({ error: "ledgerId is required." }, { status: 400 });

    const { data: ledger, error } = await supabaseAdmin
      .from("activity_booking_pricing_ledger")
      .select("*")
      .eq("id", ledgerId)
      .eq("provider", "hotelbeds")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ledger) return NextResponse.json({ error: "Activity ledger entry not found." }, { status: 404 });

    const metadata = metadataRecord(ledger.metadata);
    const indeterminate =
      ledger.payment_status === "paid" &&
      ledger.booking_status === "payment_pending" &&
      Boolean(metadata.reconfirmAttemptIndeterminateAt);

    if (!indeterminate) {
      return NextResponse.json({ error: "This activity no longer requires reconfirmation reconciliation." }, { status: 409 });
    }

    if (action === "verify_reference") {
      const reference = String(ledger.provider_booking_reference || "");
      if (!reference) return NextResponse.json({ error: "Stored Hotelbeds reference is missing." }, { status: 409 });

      const providerBooking = await getHotelbedsActivityBooking(reference, "en");
      const supplierStatus = activityBookingStatus(providerBooking);
      if (supplierStatus !== "CONFIRMED") {
        return NextResponse.json({
          ok: true,
          resolved: false,
          supplierRequestCount: 1,
          bookingCreated: false,
          supplierStatus,
          message: `Hotelbeds currently reports ${supplierStatus || "an unknown status"}. No RECONFIRM retry was made.`,
        });
      }

      const resolvedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("activity_booking_pricing_ledger")
        .update({
          booking_status: "confirmed",
          supplier_settlement_status: "settled",
          confirmed_at: resolvedAt,
          metadata: {
            ...metadata,
            providerBooking,
            reconciliation: {
              status: "confirmed_by_booking_detail",
              resolvedAt,
              resolvedBy: admin.id,
              reference,
            },
          },
        })
        .eq("id", ledger.id);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        ok: true,
        resolved: true,
        supplierRequestCount: 1,
        bookingCreated: false,
        message: "Hotelbeds booking detail confirms the activity is CONFIRMED.",
      });
    }

    if (action === "mark_not_confirmed") {
      if (String(body.confirmationText || "") !== "NOT CONFIRMED") {
        return NextResponse.json({ error: 'Type "NOT CONFIRMED" exactly.' }, { status: 400 });
      }

      const resolvedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("activity_booking_pricing_ledger")
        .update({
          booking_status: "failed",
          supplier_settlement_status: "failed",
          metadata: {
            ...metadata,
            reconciliation: {
              status: "not_confirmed",
              resolvedAt,
              resolvedBy: admin.id,
            },
            refundStatus: "manual_required",
          },
        })
        .eq("id", ledger.id);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        ok: true,
        resolved: true,
        supplierRequestCount: 0,
        bookingCreated: false,
        refundStatus: "manual_required",
        message: "Activity marked not confirmed. Paid transaction requires manual refund review.",
      });
    }

    return NextResponse.json({ error: "Unsupported reconciliation action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Activity reconciliation failed." },
      { status }
    );
  }
}
