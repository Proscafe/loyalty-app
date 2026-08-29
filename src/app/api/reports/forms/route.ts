import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ReportDefinition, ReportQuestionKind, ReportType } from "@/lib/internal-reports";
import { REPORT_TYPES } from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

const KINDS: ReportQuestionKind[] = ["yes_no", "yes_no_na", "short", "paragraph"];

function cleanDefinition(value: any): ReportDefinition | null {
  if (!value || !REPORT_TYPES.includes(value.type as ReportType)) return null;
  const sections = Array.isArray(value.sections) ? value.sections : [];
  return {
    type: value.type,
    title: String(value.title || "").trim() || value.type,
    description: String(value.description || "").trim(),
    is_active: value.is_active !== false,
    sections: sections.map((section: any, sectionIndex: number) => ({
      title: String(section?.title || "").trim() || `Section ${sectionIndex + 1}`,
      questions: (Array.isArray(section?.questions) ? section.questions : []).map((question: any, questionIndex: number) => ({
        key: String(question?.key || `${value.type}_${sectionIndex}_${questionIndex}`).trim(),
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
    .select("report_type,title,description,sections,is_active")
    .order("report_type");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    forms: (data ?? []).map((row: any) => ({
      type: row.report_type,
      title: row.title,
      description: row.description || "",
      sections: row.sections || [],
      is_active: row.is_active !== false,
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
    updated_at: new Date().toISOString(),
    updated_by: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, form: definition });
}
