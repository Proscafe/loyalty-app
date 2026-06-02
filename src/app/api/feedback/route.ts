import { NextResponse } from "next/server";
import tls from "node:tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackBody = {
  message?: string;
  client_id?: string;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_code?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function base64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "");
}

function createEmailMessage({
  from,
  to,
  replyTo,
  subject,
  text,
}: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17262c;">
      <h2 style="margin: 0 0 12px; color: #365665;">New feedback from Pro's Cafe app</h2>
      <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; background: #f5f5f0; padding: 16px; border-radius: 12px;">${escapeHtml(
        text,
      )}</pre>
    </div>
  `;

  return [
    `From: Pro's Cafe <${from}>`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="pros-feedback-boundary"',
    "",
    "--pros-feedback-boundary",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    "--pros-feedback-boundary",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    "--pros-feedback-boundary--",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function smtpCommand(socket: tls.TLSSocket, command: string, expected: number[]) {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      data += chunk.toString("utf8");

      const lines = data.trimEnd().split(/\r?\n/);
      const lastLine = lines[lines.length - 1];

      if (!/^\d{3}\s/.test(lastLine)) return;

      const code = Number(lastLine.slice(0, 3));

      cleanup();

      if (expected.includes(code)) {
        resolve(data);
      } else {
        reject(new Error(data));
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.write(`${command}\r\n`);
  });
}

function smtpRead(socket: tls.TLSSocket, expected: number[]) {
  return new Promise<string>((resolve, reject) => {
    let data = "";

    function cleanup() {
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      data += chunk.toString("utf8");

      const lines = data.trimEnd().split(/\r?\n/);
      const lastLine = lines[lines.length - 1];

      if (!/^\d{3}\s/.test(lastLine)) return;

      const code = Number(lastLine.slice(0, 3));

      cleanup();

      if (expected.includes(code)) {
        resolve(data);
      } else {
        reject(new Error(data));
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendWithGmailSmtp({
  to,
  replyTo,
  subject,
  text,
}: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}) {
  const smtpUser = process.env.GMAIL_SMTP_USER || process.env.SMTP_USER;
  const smtpPassword = normalizeAppPassword(
    process.env.GMAIL_SMTP_APP_PASSWORD || process.env.SMTP_PASSWORD || "",
  );

  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "Feedback email is not configured. Add GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD in Vercel.",
    );
  }

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  socket.setTimeout(12000);

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("SMTP connection timed out.")));
  });

  try {
    await smtpRead(socket, [220]);
    await smtpCommand(socket, "EHLO proscafe.net", [250]);
    await smtpCommand(socket, "AUTH LOGIN", [334]);
    await smtpCommand(socket, base64(smtpUser), [334]);
    await smtpCommand(socket, base64(smtpPassword), [235]);
    await smtpCommand(socket, `MAIL FROM:<${smtpUser}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);

    const emailMessage = createEmailMessage({
      from: smtpUser,
      to,
      replyTo,
      subject,
      text,
    });

    await smtpCommand(socket, `${emailMessage}\r\n.`, [250]);
    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.destroy();
  }
}

export async function POST(req: Request) {
  let body: FeedbackBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }

  const message = clean(body.message);

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const clientName = clean(body.client_name) || "Client";
  const clientEmail = clean(body.client_email);
  const clientPhone = clean(body.client_phone) || "No phone";
  const clientCode = clean(body.client_code) || "No client code";

  const emailBody = `New feedback from Pro's Cafe app

Name: ${clientName}
Email: ${clientEmail || "No email"}
Phone: ${clientPhone}
Client code: ${clientCode}
Client ID: ${clean(body.client_id) || "Unknown"}

Message:
${message}`;

  try {
    await sendWithGmailSmtp({
      to: "proscafe@gmail.com",
      replyTo: clientEmail || undefined,
      subject: `New feedback from ${clientName}`,
      text: emailBody,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not send feedback email.",
      },
      { status: 500 },
    );
  }
}
