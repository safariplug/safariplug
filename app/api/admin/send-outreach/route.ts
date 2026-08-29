import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AdminAuthError, requireAdmin } from "@/lib/auth/require-admin";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = (await request.json()) as {
      outreach_id?: unknown;
      subject?: unknown;
      message?: unknown;
    };
    const outreachId = typeof body.outreach_id === "string" ? body.outreach_id.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!outreachId || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Outreach ID, subject, and message are required." },
        { status: 400 }
      );
    }

    const { data: outreach, error: outreachError } = await supabaseAdmin
      .from("ai_sales_outreach")
      .select("id,prospect_id,approved,sent_at")
      .eq("id", outreachId)
      .maybeSingle();

    if (outreachError) {
      return NextResponse.json(
        { success: false, error: outreachError.message },
        { status: 500 }
      );
    }

    if (!outreach || !outreach.prospect_id) {
      return NextResponse.json(
        { success: false, error: "Approved outreach record not found." },
        { status: 404 }
      );
    }

    if (outreach.approved !== true) {
      return NextResponse.json(
        { success: false, error: "Outreach must be approved before sending." },
        { status: 403 }
      );
    }

    if (outreach.sent_at) {
      return NextResponse.json(
        { success: false, error: "This outreach has already been sent." },
        { status: 409 }
      );
    }

    const { data: prospect, error: prospectError } = await supabaseAdmin
      .from("ai_sales_prospects")
      .select("id,status,review_status,contact_email")
      .eq("id", outreach.prospect_id)
      .maybeSingle();

    if (prospectError) {
      return NextResponse.json(
        { success: false, error: prospectError.message },
        { status: 500 }
      );
    }

    if (!prospect) {
      return NextResponse.json(
        { success: false, error: "Linked sales prospect not found." },
        { status: 404 }
      );
    }

    if (prospect.status !== "partner" || prospect.review_status !== "approved") {
      return NextResponse.json(
        { success: false, error: "Linked prospect is not an approved partner." },
        { status: 403 }
      );
    }

    const to = typeof prospect.contact_email === "string" ? prospect.contact_email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { success: false, error: "Linked prospect does not have a valid contact email." },
        { status: 422 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.OUTREACH_FROM_EMAIL || "SafariPlug <onboarding@resend.dev>",
      to,
      subject,
      text: message,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }

    const contactedAt = new Date().toISOString();
    const { data: persistedOutreach, error: persistenceError } = await supabaseAdmin
      .from("ai_sales_outreach")
      .update({
        status: "contacted",
        sent_at: contactedAt,
        last_contacted_at: contactedAt,
      })
      .eq("id", outreachId)
      .is("sent_at", null)
      .select("id")
      .maybeSingle();

    if (persistenceError || !persistedOutreach) {
      return NextResponse.json(
        { success: false, error: "Email was sent, but outreach persistence failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unable to send outreach email.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
