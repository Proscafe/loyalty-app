import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const FEEDBACK_TO_EMAIL = "proscafe@gmail.com";

type FeedbackBody = {
  message?: string;
  clientId?: string;
  clientName?: string;
  clientCode?: string;
  clientEmail?: string;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackBody;

    const message = cleanText(body.message);
    const clientName = cleanText(body.clientName) || "Client";
    const clientCode = cleanText(body.clientCode) || "Not provided";
    const clientEmail = cleanText(body.clientEmail) || "Not provided";
    const clientId = cleanText(body.clientId) || "Not provided";

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL || process.env.SMTP_USER,
      to: FEEDBACK_TO_EMAIL,
      subject: `PRO's Club feedback from ${clientName}`,
      replyTo: clientEmail !== "Not provided" ? clientEmail : undefined,
      text: [
        "New PRO's Club feedback",
        "",
        `Client: ${clientName}`,
        `Client code: ${clientCode}`,
        `Client email: ${clientEmail}`,
        `Client ID: ${clientId}`,
        "",
        "Message:",
        message,
      ].join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Could not send feedback" },
      { status: 500 }
    );
  }
}
