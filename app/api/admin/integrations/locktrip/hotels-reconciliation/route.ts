import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { LockTripHotelAdapter } from "@/lib/integrations/hotels/locktrip";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function registeredToken(adapter: LockTripHotelAdapter) {
  const email = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_EMAIL?.trim();
  const password = process.env.SAFARIPLUG_HOTEL_LOCKTRIP_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("SafariPlug LockTrip account credentials are not configured.");
  }
  return adapter.login(email, password);
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
      .eq("provider", "locktrip")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ledger) {
      return NextResponse.json({ error: "LockTrip hotel ledger entry not found." }, { status: 404 });
    }

    const metadata = metadataRecord(ledger.metadata);
    const indeterminate =
      ledger.payment_status === "paid" &&
      ledger.booking_status === "payment_pending" &&
      Boolean(metadata.confirmAttemptIndeterminateAt);

    if (!indeterminate) {
      return NextResponse.json(
        { error: "This LockTrip hotel no longer requires indeterminate-confirmation reconciliation." },
        { status: 409 }
      );
    }

    if (action !== "verify_current_state") {
      return NextResponse.json({ error: "Unsupported reconciliation action." }, { status: 400 });
    }

    const preparedBookingId = String(ledger.prepared_booking_id || "").trim();
    if (!preparedBookingId) {
      return NextResponse.json({ error: "Prepared booking id is missing." }, { status: 409 });
    }

    const adapter = new LockTripHotelAdapter();
    const token = await registeredToken(adapter);
    const details = await adapter.getBookingDetails(token, preparedBookingId);
    const providerStatus = String(details.status || "").toUpperCase();
    const paymentStatus = String(details.paymentStatus || "").toUpperCase();
    const resolvedAt = new Date().toISOString();

    if (providerStatus === "DONE" && paymentStatus === "PAID") {
      const { error: updateError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          provider_booking_reference: details.bookingReferenceId || ledger.provider_booking_reference || null,
          booking_status: "confirmed",
          supplier_settlement_status: "settled",
          confirmed_at: details.confirmedAt || resolvedAt,
          metadata: {
            ...metadata,
            lastProviderStatus: details,
            reconciliation: {
              status: "confirmed_by_booking_detail",
              resolvedAt,
              resolvedBy: admin.id,
              supplierRequestCount: 1,
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
        supplierStatus: providerStatus,
        message: "Existing LockTrip booking verified and marked confirmed.",
      });
    }

    if (providerStatus === "CANCELLED" || providerStatus === "FAILED") {
      const { error: updateError } = await supabaseAdmin
        .from("hotel_booking_pricing_ledger")
        .update({
          booking_status: providerStatus === "CANCELLED" ? "cancelled" : "failed",
          supplier_settlement_status: "failed",
          metadata: {
            ...metadata,
            lastProviderStatus: details,
            reconciliation: {
              status: providerStatus === "CANCELLED" ? "supplier_cancelled" : "supplier_failed",
              resolvedAt,
              resolvedBy: admin.id,
              supplierRequestCount: 1,
            },
            refundStatus: "manual_required",
          },
        })
        .eq("id", ledger.id);

      if (updateError) throw new Error(updateError.message);

      return NextResponse.json({
        ok: true,
        resolved: true,
        supplierRequestCount: 1,
        bookingCreated: false,
        supplierStatus: providerStatus,
        refundStatus: "manual_required",
        message: `LockTrip reports ${providerStatus}. Customer payment remains recorded and requires refund review.`,
      });
    }

    return NextResponse.json({
      ok: true,
      resolved: false,
      supplierRequestCount: 1,
      bookingCreated: false,
      supplierStatus: providerStatus || "UNKNOWN",
      paymentStatus: paymentStatus || "UNKNOWN",
      message: "LockTrip booking is still unresolved. No supplier confirmation retry was made.",
    });
  } catch (error) {
    const status = error instanceof AdminAuthError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LockTrip hotel reconciliation failed." },
      { status }
    );
  }
}
