"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import { StaffBottomNav } from "@/components/StaffBottomNav";
import type { Profile } from "@/types";
import type {
  ReportDefinition,
  ReportQuestion,
  ReportType,
} from "@/lib/internal-reports";
import { getReportFormKind } from "@/lib/internal-reports";

const PAGE_BG =
  "linear-gradient(135deg, #798673 0%, #687468 45%, #586256 100%)";

const FORM_ORDER: string[] = [
  "floor_am_checklist",
  "floor_pm_checklist",
  "hostess_checklist",
  "floor_report",
  "kitchen_checklist",
  "kitchen_report",
];

type HistoryRow = {
  id: string;
  report_type: string;
  created_at: string | null;
};

export default function ReportsClient({
  profile,
  definitions,
  history,
}: {
  profile: Profile;
  definitions: ReportDefinition[];
  history: HistoryRow[];
}) {
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderedDefinitions = useMemo(() => {
    return [...definitions]
      .filter((item) => item.is_active !== false)
      .sort((a, b) => {
        const aIndex = FORM_ORDER.indexOf(a.type);
        const bIndex = FORM_ORDER.indexOf(b.type);

        if (aIndex === -1 && bIndex === -1) return a.title.localeCompare(b.title);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;

        return aIndex - bIndex;
      });
  }, [definitions]);

  const reportDefinitions = useMemo(
    () =>
      orderedDefinitions.filter(
        (form) => getReportFormKind(form) === "report",
      ),
    [orderedDefinitions],
  );

  const checklistDefinitions = useMemo(
    () =>
      orderedDefinitions.filter(
        (form) => getReportFormKind(form) === "checklist",
      ),
    [orderedDefinitions],
  );

  const visibleHistory = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return [...history]
      .filter((row) => {
        if (!row.created_at) return false;
        const date = new Date(row.created_at);
        return !Number.isNaN(date.getTime()) && date >= sevenDaysAgo;
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [history]);

  function historyDayLabel(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round(
      (today.getTime() - target.getTime()) / 86400000,
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function historyTime(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function openForm(form: ReportDefinition) {
    setSelected(form);
    setAnswers({});
    setMessage(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_type: selected.type,
        answers,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Could not submit report.");
      return;
    }

    setAnswers({});
    setMessage("Report submitted successfully.");
  }

  return (
    <main
      className="min-h-screen px-4 pb-32 pt-2 text-white sm:pt-5"
      style={{ background: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-md">
        {/* MOBILE: exact shared admin-style header. No Staff Console text and no ADMIN pill. */}
        <AdminMobileHeader
          title="Reports"
          homeHref="/staff"
          profileHref="/profile"
          logoSrc="/pros-logo-basic.png"
          className="mt-1"
        />

        {/* DESKTOP ONLY */}
        <div className="hidden items-center justify-between pb-5 lg:flex">
          <Link
            href="/staff"
            className="text-[12px] font-black text-white/75 transition hover:text-white"
          >
            ← Staff Console
          </Link>

          <div className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] backdrop-blur-xl">
            {profile.role === "staff"
              ? "Manager"
              : profile.role === "supervisor"
                ? "Supervisor"
                : "Admin"}
          </div>
        </div>

        {!selected ? (
          <>
            {reportDefinitions.length ? (
              <section className="mt-4">
                <div className="space-y-3">
                  {reportDefinitions.map((form) => (
                    <button
                      key={form.type}
                      type="button"
                      onClick={() => openForm(form)}
                      className="group relative w-full overflow-hidden rounded-[20px] bg-[#d4b22f] px-5 py-3.5 text-left shadow-[0_12px_24px_rgba(34,49,39,0.16)] transition hover:-translate-y-0.5 hover:brightness-[1.03] active:scale-[0.99]"
                    >
                      <div className="pr-16">
                        <div className="min-w-0">
                          <h3 className="text-[20px] font-black leading-[1.02] tracking-[-0.04em] text-white">
                            {form.title}
                          </h3>
                          <p className="mt-1 text-[11px] font-semibold leading-snug text-white/88">
                            {form.description || `Submit today’s ${form.title.toLowerCase()}.`}
                          </p>
                        </div>
                      </div>

                      <div className="absolute right-4 inset-y-0 my-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[23px] font-light text-[#6d6728] shadow-[0_7px_16px_rgba(0,0,0,0.10)]">
                        →
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {checklistDefinitions.length ? (
              <section className="mt-8">
                <h2 className="mb-4 text-[22px] font-black tracking-[-0.04em] text-white">
                  Checklists
                </h2>

                <div className="space-y-3">
                  {checklistDefinitions.map((form) => (
                    <button
                      key={form.type}
                      type="button"
                      onClick={() => openForm(form)}
                      className="group relative min-h-[72px] w-full overflow-hidden rounded-[18px] bg-white/[0.09] px-5 py-3.5 text-left shadow-[0_12px_30px_rgba(34,49,39,0.10),inset_0_0_0_1px_rgba(255,255,255,0.11)] backdrop-blur-2xl transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12] active:scale-[0.99]"
                    >
                      <div className="flex min-h-[44px] items-center pr-10">
                        <h3 className="text-[17px] font-black leading-tight tracking-[-0.025em] text-white">
                          {form.title}
                        </h3>
                      </div>

                      <div className="absolute right-5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-[27px] font-light leading-none text-[#ffd66b]">
                        ›
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd66b]">
                                      </div>
                  <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em] text-white">
                    History
                  </h2>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  Last 7 days
                </div>
              </div>

              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {visibleHistory.length ? (
                  visibleHistory.map((row) => {
                    const isKitchen = row.report_type.startsWith("kitchen_");
                    const definition = orderedDefinitions.find(
                      (item) => item.type === row.report_type,
                    );
                    const title =
                      definition?.title ??
                      row.report_type
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (letter) => letter.toUpperCase());

                    const calendarDate = row.created_at
                      ? new Date(row.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—";

                    return (
                      <div
                        key={row.id}
                        className={`flex min-h-[52px] items-center justify-between gap-3 rounded-[17px] px-3.5 py-2.5 backdrop-blur-2xl ${
                          isKitchen
                            ? "bg-[#d6bf72]/[0.14] shadow-[0_12px_30px_rgba(48,46,25,0.10),inset_0_0_0_1px_rgba(255,231,151,0.16)]"
                            : "bg-white/[0.09] shadow-[0_12px_30px_rgba(34,49,39,0.10),inset_0_0_0_1px_rgba(255,255,255,0.11)]"
                        }`}
                      >
                        <div className="min-w-0 shrink">
                          <div className="truncate text-[11px] font-black leading-none text-white">
                            {title}
                          </div>
                        </div>

                        <div className="shrink-0 whitespace-nowrap text-right text-[11px] font-black leading-none text-white/80">
                          <span
                            className={
                              isKitchen
                                ? "text-[#ffe39a]"
                                : "text-[#ffd66b]"
                            }
                          >
                            {historyDayLabel(row.created_at)}
                          </span>
                          <span className="mx-1.5 text-white/35">·</span>
                          <span>{calendarDate}</span>
                          <span className="mx-1.5 text-white/35">·</span>
                          <span className="text-white/70">
                            {historyTime(row.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] bg-white/[0.08] px-4 py-5 text-center text-[11px] font-bold text-white/55 backdrop-blur-2xl">
                    No reports submitted in the last 7 days.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setAnswers({});
                setMessage(null);
                setError(null);
              }}
              className="mb-4 text-[12px] font-black text-white/75 transition hover:text-white"
            >
              ← All Reports
            </button>

            <div className="mb-5 px-1">
              <h1 className="text-[31px] font-black leading-none tracking-[-0.05em] text-white">
                {selected.title}
              </h1>
            </div>

            <form onSubmit={submit} className="space-y-5">
              {selected.sections.map((section, sectionIndex) => (
                <section
                  key={`${section.title}-${sectionIndex}`}
                  className="rounded-[26px] bg-white/[0.09] p-4 shadow-[0_20px_50px_rgba(35,54,47,0.14),inset_0_0_0_1px_rgba(255,255,255,0.10)] backdrop-blur-2xl"
                >
                  <h2 className="mb-4 text-[13px] font-black uppercase tracking-[0.16em] text-[#ffd66b]">
                    {section.title}
                  </h2>

                  <div className="space-y-4">
                    {section.questions.map((question) => (
                      <Question
                        key={question.key}
                        question={question}
                        value={answers[question.key] || ""}
                        onChange={(value) =>
                          setAnswers((current) => ({
                            ...current,
                            [question.key]: value,
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}

              {error ? (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  {message}
                </div>
              ) : null}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-[#ffd66b] px-4 py-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#182f38] transition hover:bg-[#f3c95e] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Submit Report"}
              </button>
            </form>
          </>
        )}
      </div>
          <StaffBottomNav active="reports" isSupervisor={profile.role === "supervisor"} />
    </main>
  );
}


function ReportIcon({ type, kind }: { type: string; kind?: "report" | "checklist" }) {
  const iconClass = kind === "report" ? "h-[54px] w-[54px] fill-none stroke-current" : "h-[44px] w-[44px] fill-none stroke-current";
  const common = {
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (
    kind === "checklist" ||
    type === "floor_am_checklist" ||
    type === "floor_pm_checklist" ||
    type === "hostess_checklist"
  ) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClass}>
        <path {...common} d="M9 5.5h6M10 3.5h4a1.5 1.5 0 0 1 1.5 1.5v.5h2A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5h2V5A1.5 1.5 0 0 1 10 3.5Z" />
        <path {...common} d="m8 10 1.2 1.2L11 9.4M13.5 10.5H17M8 15l1.2 1.2L11 14.4M13.5 15.5H17" />
      </svg>
    );
  }

  if (type === "kitchen_checklist") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClass}>
        <path {...common} d="M9 5.5h6M10 3.5h4a1.5 1.5 0 0 1 1.5 1.5v.5h2A1.5 1.5 0 0 1 19 7v12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V7a1.5 1.5 0 0 1 1.5-1.5h2V5A1.5 1.5 0 0 1 10 3.5Z" />
        <path {...common} d="M9 15.8v-2.1a3 3 0 0 1 6 0v2.1M8.2 15.8h7.6M10.2 12.2h3.6" />
      </svg>
    );
  }

  if (type === "floor_report") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClass}>
        <path {...common} d="M7 3.5h6.5L18.5 8v12.5H7zM13.5 3.5V8h5" />
        <path {...common} d="M10 16v-3M13 16v-5M16 16v-7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={iconClass}>
      <path {...common} d="M7 3.5h6.5L18.5 8v12.5H7zM13.5 3.5V8h5" />
      <path {...common} d="M14.7 12.4a4 4 0 1 1-2.5-1.4v4h4a4 4 0 0 1-1.5 3.1" />
    </svg>
  );
}


function Question({
  question,
  value,
  onChange,
}: {
  question: ReportQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputClass =
    "w-full rounded-xl border-0 bg-white px-4 py-3.5 text-sm font-semibold text-[#182f38] outline-none transition focus:ring-4 focus:ring-[#ffd66b]/20";

  return (
    <div>
      <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white">
        {question.label}
        {question.required ? "*" : ""}
      </label>

      {question.kind === "yes_no" || question.kind === "yes_no_na" ? (
        <div
          className={`grid gap-2 ${
            question.kind === "yes_no_na" ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {(question.kind === "yes_no_na"
            ? ["Yes", "No", "N/A"]
            : ["Yes", "No"]
          ).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`h-12 rounded-xl text-[12px] font-black transition ${
                value === option
                  ? "bg-[#ffd66b] text-[#182f38]"
                  : "bg-white/10 text-white backdrop-blur-xl hover:bg-white/15"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : question.kind === "paragraph" ? (
        <textarea
          required={question.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-h-[120px] resize-none`}
        />
      ) : (
        <input
          required={question.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
