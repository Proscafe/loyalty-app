import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import ReportsPageClient from "./ReportsPageClient";
import {
  REPORT_DEFINITIONS,
  type ReportDefinition,
} from "@/lib/internal-reports";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: string;
  report_type: string;
  submitted_by: string;
  submitted_by_name?: string | null;
  submitted_by_role?: string | null;
  submitted_by_phone?: string | null;
  answers?: Record<string, string> | null;
  created_at?: string | null;
};

type TeamUser = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  is_active?: boolean | null;
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

export default async function AdminReportsPage() {
  await requireRole(["master_admin"]);

  const supabase = await createClient();

  const [reportsResult, formsResult, settingsResult, teamResult] =
    await Promise.all([
      supabase
        .from("internal_reports")
        .select(
          "id, report_type, submitted_by, submitted_by_name, submitted_by_role, answers, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000),

      supabase
        .from("internal_report_forms")
        .select(
          "report_type,title,description,sections,is_active,allowed_roles,is_deleted",
        )
        .order("report_type"),

      supabase
        .from("internal_report_settings")
        .select(
          "email_enabled,email_recipients,email_report_types,email_recipient_rules",
        )
        .eq("id", 1)
        .maybeSingle(),

      supabase
        .from("profiles")
        .select("id,full_name,phone,role,is_active")
        .in("role", ["staff", "supervisor", "master_admin"])
        .eq("is_active", true)
        .order("full_name"),
    ]);

  const forms = mergeDefinitions(formsResult.data);
  const ACTIVE_TEAM_ROLES = new Set([
    "staff",
    "supervisor",
    "master_admin",
  ]);

  const teamUsers = ((teamResult.data ?? []) as TeamUser[]).filter(
    (user) =>
      user.is_active === true &&
      ACTIVE_TEAM_ROLES.has(
        String(user.role ?? "")
          .trim()
          .toLowerCase(),
      ),
  );

  const teamById = new Map(
    teamUsers.map((user) => [String(user.id), user]),
  );

  const reports = ((reportsResult.data ?? []) as ReportRow[]).map(
    (report) => {
      const teamUser = teamById.get(String(report.submitted_by));

      return {
        ...report,
        submitted_by_phone: teamUser?.phone ?? null,
      };
    },
  );

  return (
    <ReportsPageClient
      reports={reports}
      teamUsers={teamUsers}
      initialForms={forms}
      initialSettings={settingsResult.data ?? null}
    />
  );
}
