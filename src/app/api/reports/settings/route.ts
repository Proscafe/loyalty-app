import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REPORT_TYPES, type ReportType } from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  await requireRole(["master_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("internal_report_settings")
    .select("email_enabled,email_recipients,email_report_types,email_recipient_rules")
    .eq("id", 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    settings: data ?? {
      email_enabled: true,
      email_recipients: [],
      email_report_types: REPORT_TYPES,
      email_recipient_rules: [],
    },
  });
}

export async function PUT(request: Request) {
  const profile = await requireRole(["master_admin"]);
  const body = await request.json().catch(() => ({}));

  const recipients = Array.from(
    new Set(
      (Array.isArray(body.email_recipients) ? body.email_recipients : [])
        .map((value: unknown) => String(value).trim().toLowerCase())
        .filter((value: string) => value && validEmail(value)),
    ),
  );

  const reportTypes = (Array.isArray(body.email_report_types) ? body.email_report_types : [])
    .filter((value: unknown): value is ReportType => REPORT_TYPES.includes(value as ReportType));

  const recipientRules = (Array.isArray(body.email_recipient_rules) ? body.email_recipient_rules : [])
    .map((rule: any) => ({
      email: String(rule?.email ?? "").trim().toLowerCase(),
      report_types: (Array.isArray(rule?.report_types) ? rule.report_types : [])
        .filter((value: unknown): value is ReportType => REPORT_TYPES.includes(value as ReportType)),
    }))
    .filter((rule: { email: string; report_types: ReportType[] }) => validEmail(rule.email) && rule.report_types.length > 0);

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("internal_report_settings")
    .upsert({
      id: 1,
      email_enabled: body.email_enabled !== false,
      email_recipients: recipients,
      email_report_types: reportTypes,
      email_recipient_rules: recipientRules,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .select("email_enabled,email_recipients,email_report_types,email_recipient_rules")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    settings: saved,
  });
}
