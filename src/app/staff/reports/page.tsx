import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsClient from "./ReportsClient";
import {
  REPORT_DEFINITIONS,
  type ReportDefinition,
} from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

type HistoryRow = {
  id: string;
  report_type: string;
  created_at: string | null;
};

function mergeDefinitions(
  databaseForms: any[] | null | undefined,
): ReportDefinition[] {
  const merged = new Map<string, ReportDefinition>();

  for (const definition of REPORT_DEFINITIONS) {
    merged.set(definition.type, definition);
  }

  for (const row of databaseForms ?? []) {
    const type = String(row.report_type);

    if (row.is_deleted === true) {
      merged.delete(type);
      continue;
    }

    merged.set(type, {
      type,
      title: row.title,
      description: row.description || "",
      sections: row.sections || [],
      is_active: row.is_active !== false,
      allowed_roles: Array.isArray(row.allowed_roles)
        ? row.allowed_roles
        : ["staff", "supervisor", "master_admin"],
      is_deleted: false,
      form_kind:
        row.form_kind === "report" ||
        /\breport\b/i.test(String(row.title ?? "")) ||
        type.endsWith("_report")
          ? "report"
          : "checklist",
    });
  }

  return Array.from(merged.values());
}

export default async function StaffReportsPage() {
  const profile = await requireRole([
    "staff",
    "supervisor",
    "master_admin",
  ]);

  const supabase = await createClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [formsResult, historyResult] = await Promise.all([
    supabase
      .from("internal_report_forms")
      .select("report_type,title,description,sections,is_active,allowed_roles,is_deleted,form_kind"),
    supabase
      .from("internal_reports")
      .select("id,report_type,created_at")
      .eq("submitted_by", profile.id)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <ReportsClient
      profile={profile}
      definitions={mergeDefinitions(formsResult.data).filter((definition) => {
        const roles =
          Array.isArray(definition.allowed_roles) && definition.allowed_roles.length
            ? definition.allowed_roles
            : ["staff", "supervisor", "master_admin"];

        return definition.is_active !== false && roles.includes(profile.role);
      })}
      history={(historyResult.data ?? []) as HistoryRow[]}
    />
  );
}
