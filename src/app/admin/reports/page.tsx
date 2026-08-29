import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsPageClient from "./ReportsPageClient";
import type { ReportDefinition } from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  report_type: string;
  submitted_by: string;
  submitted_by_name?: string | null;
  submitted_by_role?: string | null;
  answers?: Record<string, string> | null;
  created_at?: string | null;
};

export default async function AdminReportsPage() {
  await requireRole(["master_admin"]);
  const supabase = await createClient();

  const [reportsResult, formsResult, settingsResult] = await Promise.all([
    supabase
      .from("internal_reports")
      .select("id, report_type, submitted_by, submitted_by_name, submitted_by_role, answers, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("internal_report_forms")
      .select("report_type,title,description,sections,is_active")
      .order("report_type"),
    supabase
      .from("internal_report_settings")
      .select("email_enabled,email_recipients,email_report_types")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  const forms: ReportDefinition[] = (formsResult.data ?? []).map((row: any) => ({
    type: row.report_type,
    title: row.title,
    description: row.description || "",
    sections: row.sections || [],
    is_active: row.is_active !== false,
  }));

  return (
    <ReportsPageClient
      reports={(reportsResult.data ?? []) as ReportRow[]}
      initialForms={forms}
      initialSettings={settingsResult.data ?? null}
    />
  );
}
