import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { HotelbedsHotelAdapter } from "@/lib/integrations/hotels/hotelbeds";

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

    if (!ledgerId) {
      return NextResponse.json({ error: "ledgerId is required." }, { status: 400 });
    }

    const { data: ledger, error } = await supabaseAdmin
      .from("hotel_booking_pricing_ledger")
      .select("*")
      .eq("id", ledgerId)
      .eq("provider", "hotelbeds")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ledger) {
      return NextResponse.json({ error: "Hotel ledger entry not found." }, { status: 404 });
    }

    const metadata = metadataRecord(ledger.metadata);
    const indeterminate =
      ledger.payment_status === "paid" &&
      ledger.booking_status === "payment_pending" &&
      Boolean(metadata.confirmAttemptIndeterminateAt);

    if (!indeterminate) {
      return NextResponse.json(
        { error: "This hotel no longer requires indeterminate-confirmation reconciliation." },
        { status: 409 }
      );
    }

    if (action === "verify_reference") {
      const reference = String(body.reference || "").trim();
      if (!reference) {
        return NextResponse.json({ error: "Hotelbeds booking reference is required." }, { status: 400 });
      }

      const adapter = new HotelbedsHotelAdapter();
      const providerBooking = await adapter.getBooking(reference);
      const status = String(providerBooking.booking?.status || "").toUpperCase();

      if (status !== "CONFIRMED") {
        return NextResponse.json({
          ok: true,
          resolved: false,
          supplierRequestCount: 1,
          bookingCreated: false,
          supplierStatus: status || "UNKNOWN",
          message: `Hotelbeds currently reports ${status || "an unknown status"}. No booking retry was made.`,
        });
      }

      const resolvedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          provider_booking_reference: reference,
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
        message: "Existing Hotelbeds hotel booking verified and reconciliation marked confirmed.",
      });
    }

    if (action === "mark_not_booked") {
      if (String(body.confirmationText || "") !== "NO SUPPLIER BOOKING") {
        return NextResponse.json(
          { error: 'Type "NO SUPPLIER BOOKING" exactly.' },
          { status: 400 }
        );
      }

      const resolvedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          booking_status: "failed",
          supplier_settlement_status: "failed",
          metadata: {
            ...metadata,
            reconciliation: {
              status: "no_supplier_booking",
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
        message:
          "No supplier booking recorded. Customer payment remains paid and requires manual refund review.",
      });
    }

    return NextResponse.json({ error: "Unsupported reconciliation action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hotel reconciliation failed." },
      { status }
    );
  }
}
