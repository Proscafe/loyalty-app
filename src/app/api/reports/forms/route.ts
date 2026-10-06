import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportDefinition, ReportQuestionKind, ReportFormKind } from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

const KINDS: ReportQuestionKind[] = ["yes_no", "yes_no_na", "short", "paragraph"];
const ALLOWED_ROLES = ["staff", "supervisor", "master_admin"];

function cleanReportType(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function cleanDefinition(value: any): ReportDefinition | null {
  if (!value) return null;

  const type = cleanReportType(value.type || value.title);
  if (!type) return null;
  const sections = Array.isArray(value.sections) ? value.sections : [];
  const allowedRoles = Array.isArray(value.allowed_roles)
    ? value.allowed_roles
        .map((role: unknown) => String(role ?? "").trim())
        .filter((role: string) => ALLOWED_ROLES.includes(role))
    : [...ALLOWED_ROLES];

  const title = String(value.title || "").trim() || type;
  const requestedKind = String(value.form_kind ?? "").trim().toLowerCase();
  const formKind: ReportFormKind =
    /\breport\b/i.test(title) || type.endsWith("_report")
      ? "report"
      : requestedKind === "report"
        ? "report"
        : "checklist";

  return {
    type,
    title,
    description: String(value.description || "").trim(),
    is_active: value.is_active !== false,
    allowed_roles: allowedRoles.length ? Array.from(new Set(allowedRoles)) : [...ALLOWED_ROLES],
    is_deleted: false,
    form_kind: formKind,
    sections: sections.map((section: any, sectionIndex: number) => ({
      title: String(section?.title || "").trim() || `Section ${sectionIndex + 1}`,
      questions: (Array.isArray(section?.questions) ? section.questions : []).map((question: any, questionIndex: number) => ({
        key: String(question?.key || `${type}_${sectionIndex}_${questionIndex}`).trim(),
        label: String(question?.label || "").trim() || `Question ${questionIndex + 1}`,
        kind: KINDS.includes(question?.kind) ? question.kind : "short",
        required: question?.required !== false,
      })),
    })),
  };
}

export async function GET() {
  await requireRole(["staff", "supervisor", "master_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("internal_report_forms")
    .select("report_type,title,description,sections,is_active,allowed_roles,is_deleted,form_kind")
    .order("report_type");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    forms: (data ?? []).map((row: any) => ({
      type: row.report_type,
      title: row.title,
      description: row.description || "",
      sections: row.sections || [],
      is_active: row.is_active !== false,
      allowed_roles: Array.isArray(row.allowed_roles) ? row.allowed_roles : [...ALLOWED_ROLES],
      is_deleted: row.is_deleted === true,
      form_kind:
        row.form_kind === "report" ||
        /\breport\b/i.test(String(row.title ?? "")) ||
        String(row.report_type ?? "").endsWith("_report")
          ? "report"
          : "checklist",
    })),
  });
}

export async function PUT(request: Request) {
  const profile = await requireRole(["master_admin"]);
  const body = await request.json().catch(() => null);
  const definition = cleanDefinition(body?.form);
  if (!definition) return NextResponse.json({ error: "Invalid report form." }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("internal_report_forms").upsert({
    report_type: definition.type,
    title: definition.title,
    description: definition.description || null,
    sections: definition.sections,
    is_active: definition.is_active !== false,
    allowed_roles: definition.allowed_roles ?? [...ALLOWED_ROLES],
    is_deleted: false,
    form_kind: definition.form_kind ?? "checklist",
    updated_at: new Date().toISOString(),
    updated_by: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, form: definition });
}


export async function DELETE(request: Request) {
  const profile = await requireRole(["master_admin"]);
  const url = new URL(request.url);
  const type = cleanReportType(url.searchParams.get("type"));

  if (!type) {
    return NextResponse.json(
      { error: "Missing report type." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("internal_report_forms")
    .select("report_type,title,description,sections,is_active,allowed_roles,is_deleted,form_kind")
    .eq("report_type", type)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 },
    );
  }

  const payload = existing
    ? {
        ...existing,
        is_active: false,
        is_deleted: true,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }
    : {
        report_type: type,
        title: type.replaceAll("_", " "),
        description: null,
        sections: [],
        is_active: false,
        allowed_roles: [],
        is_deleted: true,
        form_kind: type.endsWith("_report") ? "report" : "checklist",
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      };

  const { error } = await supabase
    .from("internal_report_forms")
    .upsert(payload);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, type });
}
