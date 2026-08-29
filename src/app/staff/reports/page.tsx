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
      .select("report_type,title,description,sections,is_active")
      .eq("is_active", true),
    supabase
      .from("internal_reports")
      .select("id,report_type,created_at")
      .eq("submitted_by", profile.id)
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const definitions: ReportDefinition[] = formsResult.data?.length
    ? formsResult.data.map((row: any) => ({
        type: row.report_type,
        title: row.title,
        description: row.description || "",
        sections: row.sections || [],
        is_active: row.is_active !== false,
      }))
    : REPORT_DEFINITIONS;

  return (
    <ReportsClient
      profile={profile}
      definitions={definitions}
      history={(historyResult.data ?? []) as HistoryRow[]}
    />
  );
}
