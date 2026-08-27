import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      to?: unknown;
      subject?: unknown;
      message?: unknown;
    };
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Recipient, subject, and message are required." },
        { status: 400 }
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

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send outreach email.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
