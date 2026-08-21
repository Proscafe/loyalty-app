"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";

type QuestionType = "rating" | "select" | "textarea";

type CommentCardQuestion = {
  id: string;
  question_key: string;
  question_text: string;
  question_type: QuestionType;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  options: string[] | null;
  is_system: boolean;
};

type DraftMap = Record<
  string,
  {
    question_text: string;
    is_active: boolean;
    is_required: boolean;
    optionsText: string;
  }
>;

const PAGE_BG =
  "radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";

function typeLabel(type: QuestionType) {
  if (type === "rating") return "Rating · 1–5";
  if (type === "select") return "Multiple choice";
  return "Written response";
}

export default function CommentCardQuestionsClient() {
  const [questions, setQuestions] = useState<CommentCardQuestion[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<QuestionType>("rating");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");
  const [adding, setAdding] = useState(false);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/comment-card-questions", {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => ({}))) as {
        questions?: CommentCardQuestion[];
        error?: string;
      };

      if (!response.ok) throw new Error(json.error || "Could not load questions.");

      const nextQuestions = json.questions ?? [];
      setQuestions(nextQuestions);
      setDrafts(
        Object.fromEntries(
          nextQuestions.map((question) => [
            question.id,
            {
              question_text: question.question_text,
              is_active: question.is_active,
              is_required: question.is_required,
              optionsText: Array.isArray(question.options)
                ? question.options.join("\n")
                : "",
            },
          ]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const activeCount = useMemo(
    () => questions.filter((question) => question.is_active).length,
    [questions],
  );

  function updateDraft(id: string, patch: Partial<DraftMap[string]>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  async function patchQuestion(
    question: CommentCardQuestion,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setSavingId(question.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/comment-card-questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: question.id, ...payload }),
      });

      const json = (await response.json().catch(() => ({}))) as {
        question?: CommentCardQuestion;
        error?: string;
      };

      if (!response.ok || !json.question) {
        throw new Error(json.error || "Could not save question.");
      }

      const saved = json.question;

      setQuestions((current) =>
        current
          .map((item) => (item.id === saved.id ? saved : item))
          .sort((a, b) => a.sort_order - b.sort_order),
      );

      setDrafts((current) => ({
        ...current,
        [saved.id]: {
          question_text: saved.question_text,
          is_active: saved.is_active,
          is_required: saved.is_required,
          optionsText: Array.isArray(saved.options)
            ? saved.options.join("\n")
            : "",
        },
      }));

      setMessage(successMessage);
      window.setTimeout(() => setMessage(""), 2200);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save question.");
    } finally {
      setSavingId(null);
    }
  }

  async function saveQuestion(question: CommentCardQuestion) {
    const draft = drafts[question.id];
    if (!draft) return;

    await patchQuestion(
      question,
      {
        question_text: draft.question_text,
        is_active: draft.is_active,
        is_required: draft.is_required,
        options:
          question.question_type === "select"
            ? draft.optionsText.split("\n").map((item) => item.trim()).filter(Boolean)
            : [],
      },
      "Question saved.",
    );
  }

  async function toggleQuestion(question: CommentCardQuestion) {
    const draft = drafts[question.id];
    const nextActive = !(draft?.is_active ?? question.is_active);

    updateDraft(question.id, { is_active: nextActive });

    await patchQuestion(
      question,
      { is_active: nextActive },
      nextActive ? "Question enabled." : "Question disabled.",
    );
  }

  async function moveQuestion(question: CommentCardQuestion, direction: -1 | 1) {
    const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((item) => item.id === question.id);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;

    const other = ordered[swapIndex];

    await Promise.all([
      fetch("/api/admin/comment-card-questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: question.id, sort_order: other.sort_order }),
      }),
      fetch("/api/admin/comment-card-questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: other.id, sort_order: question.sort_order }),
      }),
    ]);

    await loadQuestions();
  }

  async function addQuestion() {
    const text = newText.trim();
    if (!text) {
      setError("Enter the new question.");
      return;
    }

    setAdding(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/comment-card-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: text,
          question_type: newType,
          is_required: newRequired,
          options:
            newType === "select"
              ? newOptions.split("\n").map((item) => item.trim()).filter(Boolean)
              : [],
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.error || "Could not add question.");
      }

      setAddOpen(false);
      setNewText("");
      setNewType("rating");
      setNewRequired(false);
      setNewOptions("");
      await loadQuestions();
      setMessage("New question added.");
      window.setTimeout(() => setMessage(""), 2200);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add question.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <AdminPageShell active="comment-cards">
      <style>{`@media (min-width: 1024px) { html, body, main, [data-nextjs-scroll-focus-boundary] { background: ${PAGE_BG} !important; } }`}</style>

      <div className="relative min-h-screen px-4 py-5 lg:-m-6 lg:px-10 lg:py-8">
        <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: PAGE_BG }} />

        <div className="mb-5 lg:hidden">
          <AdminMobileHeader />
        </div>

        <header className="mb-5 rounded-[26px] border border-white/10 bg-white/10 px-5 py-5 text-white backdrop-blur-2xl lg:flex lg:items-end lg:justify-between lg:rounded-none lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-0">
          <div>
            <Link
              href="/admin/comment-cards"
              className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ffd66b]"
            >
              ← Comment Cards
            </Link>

            <h1 className="mt-4 text-[27px] font-black tracking-[-0.04em] lg:text-[34px]">
              Questions
            </h1>
            <p className="mt-2 max-w-[620px] text-[13px] font-bold leading-5 text-white/65">
              Edit, disable, reorder, or add questions. Changes are used directly by the customer Comment Card.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-10 rounded-full bg-[#ffd66b] px-5 text-[11px] font-black uppercase tracking-[0.08em] text-[#365665]"
            >
              + Add Question
            </button>
            <span className="rounded-full bg-white/10 px-4 py-2 text-[11px] font-black text-white/75">
              {activeCount} active
            </span>
          </div>
        </header>

        {message ? (
          <div className="mb-4 rounded-[18px] bg-[#9cffc9] px-4 py-3 text-[12px] font-black text-[#263f49]">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-[18px] bg-[#ffdad6] px-4 py-3 text-[12px] font-black text-[#7a2f2a]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/10 p-8 text-sm font-black text-white/70">
            Loading questions…
          </div>
        ) : (
          <section className="space-y-3">
            {questions.map((question, index) => {
              const draft = drafts[question.id];
              if (!draft) return null;

              return (
                <article
                  key={question.id}
                  className={`rounded-[26px] border p-4 text-white backdrop-blur-2xl lg:p-5 ${
                    draft.is_active
                      ? "border-white/12 bg-white/10"
                      : "border-white/8 bg-black/10 opacity-65"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => void moveQuestion(question, -1)}
                        disabled={index === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-black disabled:opacity-25"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveQuestion(question, 1)}
                        disabled={index === questions.length - 1}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-black disabled:opacity-25"
                      >
                        ↓
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/65">
                          {typeLabel(question.question_type)}
                        </span>
                        {question.is_system ? (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/45">
                            Existing
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#a98cff] px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#263f49]">
                            Custom
                          </span>
                        )}
                      </div>

                      <input
                        value={draft.question_text}
                        onChange={(event) =>
                          updateDraft(question.id, { question_text: event.target.value })
                        }
                        className="h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                      />

                      {question.question_type === "select" ? (
                        <textarea
                          value={draft.optionsText}
                          onChange={(event) =>
                            updateDraft(question.id, { optionsText: event.target.value })
                          }
                          placeholder="One choice per line"
                          className="mt-3 min-h-[120px] w-full rounded-[16px] border-0 bg-white px-4 py-3 text-[13px] font-bold text-[#365665] outline-none"
                        />
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleQuestion(question)}
                          className={`h-10 rounded-full px-4 text-[11px] font-black ${
                            draft.is_active
                              ? "bg-[#9cffc9] text-[#365665]"
                              : "bg-white/12 text-white"
                          }`}
                        >
                          {draft.is_active ? "Enabled" : "Disabled"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(question.id, { is_required: !draft.is_required })
                          }
                          className={`h-10 rounded-full px-4 text-[11px] font-black ${
                            draft.is_required
                              ? "bg-[#ffd66b] text-[#365665]"
                              : "bg-white/12 text-white"
                          }`}
                        >
                          {draft.is_required ? "Required" : "Optional"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void saveQuestion(question)}
                          disabled={savingId === question.id}
                          className="ml-auto h-10 rounded-full bg-[#ffd66b] px-5 text-[11px] font-black text-[#365665] disabled:opacity-50"
                        >
                          {savingId === question.id ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {addOpen ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
            onClick={() => setAddOpen(false)}
          >
            <div
              className="w-full max-w-[460px] rounded-[28px] bg-[#263f49] p-5 text-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-[24px] font-black">Add Question</h2>

              <label className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                Question
              </label>
              <input
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                className="mt-2 h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
                placeholder="Write the new question"
              />

              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
                Answer type
              </label>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value as QuestionType)}
                className="mt-2 h-12 w-full rounded-[16px] border-0 bg-white px-4 text-[13px] font-black text-[#365665] outline-none"
              >
                <option value="rating">Rating · 1–5</option>
                <option value="select">Multiple choice</option>
                <option value="textarea">Written response</option>
              </select>

              {newType === "select" ? (
                <textarea
                  value={newOptions}
                  onChange={(event) => setNewOptions(event.target.value)}
                  placeholder={"Choice 1\nChoice 2\nChoice 3"}
                  className="mt-4 min-h-[120px] w-full rounded-[16px] border-0 bg-white px-4 py-3 text-[13px] font-bold text-[#365665] outline-none"
                />
              ) : null}

              <button
                type="button"
                onClick={() => setNewRequired((current) => !current)}
                className={`mt-4 h-10 rounded-full px-4 text-[11px] font-black ${
                  newRequired
                    ? "bg-[#ffd66b] text-[#365665]"
                    : "bg-white/10 text-white"
                }`}
              >
                {newRequired ? "Required" : "Optional"}
              </button>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="h-11 rounded-full px-5 text-[11px] font-black"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void addQuestion()}
                  disabled={adding || !newText.trim()}
                  className="h-11 rounded-full bg-[#ffd66b] px-6 text-[11px] font-black text-[#365665] disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Add Question"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
