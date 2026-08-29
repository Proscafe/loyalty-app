import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REPORT_TYPES, type ReportDefinition, type ReportType } from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function roleLabel(role: string) {
  if (role === "staff") return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "master_admin") return "Admin";
  return role;
}

async function sendReportEmail({
  recipients,
  definition,
  answers,
  submitter,
  role,
  createdAt,
}: {
  recipients: string[];
  definition: ReportDefinition;
  answers: Record<string, string>;
  submitter: string;
  role: string;
  createdAt: string;
}) {
  const user =
    process.env.GMAIL_SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;
  const pass =
    process.env.GMAIL_SMTP_APP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASSWORD;

  if (!user || !pass || recipients.length === 0) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const sections = definition.sections.map((section) => `
    <div style="margin-top:24px">
      <h2 style="font-size:16px;margin:0 0 10px;color:#365665">${escapeHtml(section.title)}</h2>
      ${section.questions.map((question) => {
        const answer = String(answers[question.key] ?? "").trim() || "—";
        const bad = answer === "No";
        return `<div style="padding:12px 14px;margin:0 0 8px;border-radius:12px;background:${bad ? "#ffe2de" : "#f3f5f2"}">
          <div style="font-size:11px;font-weight:700;color:#65747a;text-transform:uppercase">${escapeHtml(question.label)}</div>
          <div style="margin-top:5px;font-size:14px;font-weight:700;color:${bad ? "#a62d23" : "#182f38"};white-space:pre-wrap">${escapeHtml(answer)}</div>
        </div>`;
      }).join("")}
    </div>
  `).join("");

  await transporter.sendMail({
    from: `"PRO's Cafe Reports" <${user}>`,
    to: recipients.join(", "),
    subject: `${definition.title} — ${submitter}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#182f38">
        <div style="background:#365665;padding:22px;border-radius:18px;color:white">
          <div style="font-size:12px;font-weight:700;color:#ffd66b">${escapeHtml(roleLabel(role))}</div>
          <h1 style="margin:6px 0 4px;font-size:26px">${escapeHtml(definition.title)}</h1>
          <div style="font-size:14px">${escapeHtml(submitter)} · ${escapeHtml(new Date(createdAt).toLocaleString())}</div>
        </div>
        ${sections}
      </div>
    `,
  });
}

export async function POST(request: Request) {
  const profile = await requireRole(["staff", "supervisor", "master_admin"]);
  const body = await request.json().catch(() => null);
  const reportType = body?.report_type as ReportType;
  const answers = body?.answers;

  if (!REPORT_TYPES.includes(reportType) || !answers || typeof answers !== "object" || Array.isArray(answers)) {
    return NextResponse.json({ error: "Invalid report submission." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: formRow, error: formError } = await supabase
    .from("internal_report_forms")
    .select("report_type,title,description,sections,is_active")
    .eq("report_type", reportType)
    .maybeSingle();

  if (formError || !formRow || formRow.is_active === false) {
    return NextResponse.json({ error: formError?.message || "This report form is unavailable." }, { status: 400 });
  }

  const definition: ReportDefinition = {
    type: formRow.report_type,
    title: formRow.title,
    description: formRow.description || "",
    sections: formRow.sections || [],
    is_active: formRow.is_active !== false,
  };

  for (const section of definition.sections) {
    for (const question of section.questions) {
      if (question.required && !String(answers[question.key] ?? "").trim()) {
        return NextResponse.json({ error: `Please answer: ${question.label}` }, { status: 400 });
      }
    }
  }

  const cleanAnswers: Record<string, string> = {};
  for (const section of definition.sections) {
    for (const question of section.questions) {
      cleanAnswers[question.key] = String(answers[question.key] ?? "").trim();
    }
  }

  const createdAt = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("internal_reports")
    .insert({
      report_type: reportType,
      submitted_by: profile.id,
      submitted_by_name: profile.full_name || "Unknown",
      submitted_by_role: profile.role,
      answers: cleanAnswers,
      created_at: createdAt,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Email is intentionally best-effort: a mail outage must never lose the report.
  try {
    const { data: settings } = await supabase
      .from("internal_report_settings")
      .select("email_enabled,email_recipients,email_report_types")
      .eq("id", 1)
      .maybeSingle();

    const recipients = Array.isArray(settings?.email_recipients) ? settings.email_recipients : [];
    const enabledTypes = Array.isArray(settings?.email_report_types) ? settings.email_report_types : [];

    if (settings?.email_enabled && recipients.length && enabledTypes.includes(reportType)) {
      await sendReportEmail({
        recipients,
        definition,
        answers: cleanAnswers,
        submitter: profile.full_name || "Unknown",
        role: profile.role,
        createdAt,
      });
    }
  } catch (error) {
    console.error("Report email failed:", error);
  }

  return NextResponse.json({ ok: true, id: inserted?.id });
}
