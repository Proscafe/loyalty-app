"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

type NormalizedPhoneResult =
  | { valid: true; value: string }
  | { valid: false; message: string };

const LEBANON_PHONE_PREFIXES = [
  "1", "3", "4", "5", "6", "7", "8", "9", "70", "71", "76", "78", "79", "81",
];

function normalizeLebanonPhone(rawValue: string): NormalizedPhoneResult {
  const value = rawValue.trim();

  if (!value) return { valid: false, message: "Please enter a phone number." };

  if (/[^\d\s()+-]/.test(value)) {
    return {
      valid: false,
      message: "Phone number can only contain numbers, spaces, +, -, and parentheses.",
    };
  }

  const compact = value.replace(/[\s()-]/g, "");
  const digitsOnly = compact.replace(/\D/g, "");

  if (
    (compact.match(/\+/g) || []).length > 1 ||
    (compact.includes("+") && !compact.startsWith("+")) ||
    digitsOnly.length < 7 ||
    digitsOnly.length > 11 ||
    /^(\d)\1+$/.test(digitsOnly)
  ) {
    return { valid: false, message: "Please enter a real phone number." };
  }

  let localNumber = compact.startsWith("+961")
    ? compact.slice(4)
    : digitsOnly.startsWith("961")
      ? digitsOnly.slice(3)
      : digitsOnly;

  if (localNumber.startsWith("0")) localNumber = localNumber.slice(1);

  const validLength = localNumber.length === 7 || localNumber.length === 8;
  const validPrefix = LEBANON_PHONE_PREFIXES.some((prefix) =>
    localNumber.startsWith(prefix),
  );

  if (!validLength || !validPrefix || /^(\d)\1+$/.test(localNumber)) {
    return {
      valid: false,
      message:
        "Please enter a valid Lebanese phone number, e.g. 03 123 456 or +961 71 123 456.",
    };
  }

  return { valid: true, value: `+961${localNumber}` };
}

function cleanPhoneInput(value: string) {
  return value.replace(/[^\d\s()+-]/g, "");
}

function StarRating({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required: boolean;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/12 px-4 py-3.5 backdrop-blur-sm">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
        {label}
        {required ? "*" : ""}
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`text-[31px] leading-none transition ${
              star <= value ? "text-[#ffd66b]" : "text-white/38"
            }`}
          >
            ★
          </button>
        ))}
        {value ? (
          <span className="ml-2 text-[12px] font-black text-white/80">
            {value}/5
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CommentCardForm() {
  const supabase = useMemo(() => createClient(), []);

  const [questions, setQuestions] = useState<CommentCardQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");

  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thankYouOpen, setThankYouOpen] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#182f38] outline-none transition placeholder:text-[#182f38]/35 focus:border-[#ffd66b]/80 focus:ring-4 focus:ring-[#ffd66b]/20";
  const labelClass =
    "mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-white";

  const dayOptions = Array.from({ length: 31 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );

  const monthOptions = [
    ["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"],
    ["05", "May"], ["06", "June"], ["07", "July"], ["08", "August"],
    ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"],
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 90 }, (_, index) =>
    String(currentYear - index),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        const response = await fetch("/api/comment-card/questions", {
          cache: "no-store",
        });
        const json = await response.json();

        if (!response.ok) throw new Error(json.error || "Could not load questions.");

        if (!cancelled) {
          setQuestions(Array.isArray(json.questions) ? json.questions : []);
        }
      } catch (loadError) {
        console.error(loadError);
        if (!cancelled) setError("Could not load Comment Card questions.");
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setFullName("");
    setPhone("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setAnswers({});
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    for (const question of questions) {
      if (!question.is_required) continue;
      const answer = answers[question.id];

      if (
        answer === undefined ||
        answer === null ||
        String(answer).trim() === "" ||
        (question.question_type === "rating" && Number(answer) === 0)
      ) {
        setError(`Please answer: ${question.question_text}`);
        return;
      }
    }

    const phoneResult = normalizeLebanonPhone(phone);

    if (!phoneResult.valid) {
      setError(phoneResult.message);
      return;
    }

    setLoading(true);

    const birthdayValue =
      birthDay && birthMonth && birthYear
        ? `${birthYear}-${birthMonth}-${birthDay}`
        : null;

    const byKey = Object.fromEntries(
      questions.map((question) => [
        question.question_key,
        answers[question.id],
      ]),
    );

    const { data: card, error: insertError } = await supabase
      .from("comment_cards")
      .insert({
        full_name: fullName.trim(),
        phone: phoneResult.value,
        birthday: birthdayValue,
        experience_rating: byKey.experience_rating
          ? Number(byKey.experience_rating)
          : null,
        food_rating: byKey.food_rating ? Number(byKey.food_rating) : null,
        service_rating: byKey.service_rating ? Number(byKey.service_rating) : null,
        cleanliness_rating: byKey.cleanliness_rating
          ? Number(byKey.cleanliness_rating)
          : null,
        visit_again_rating: byKey.visit_again_rating
          ? Number(byKey.visit_again_rating)
          : null,
        heard_about_us: byKey.heard_about_us
          ? String(byKey.heard_about_us)
          : null,
        comments: byKey.comments ? String(byKey.comments).trim() : null,
      })
      .select("id")
      .single();

    if (insertError || !card) {
      setError(insertError?.message || "Could not submit feedback.");
      setLoading(false);
      return;
    }

    const customAnswers = questions
      .filter((question) => !question.is_system)
      .map((question) => {
        const value = answers[question.id];

        return {
          comment_card_id: card.id,
          question_id: question.id,
          question_key: question.question_key,
          answer_number:
            question.question_type === "rating" && value !== undefined
              ? Number(value)
              : null,
          answer_text:
            question.question_type !== "rating" && value !== undefined
              ? String(value).trim() || null
              : null,
        };
      })
      .filter(
        (answer) =>
          answer.answer_number !== null || answer.answer_text !== null,
      );

    if (customAnswers.length) {
      const { error: answersError } = await supabase
        .from("comment_card_answers")
        .insert(customAnswers);

      if (answersError) {
        setError(answersError.message);
        setLoading(false);
        return;
      }
    }

    resetForm();
    setThankYouOpen(true);
    setLoading(false);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4 font-raleway">
        <div>
          <label className={labelClass} htmlFor="full_name">
            Full Name*
          </label>
          <input
            id="full_name"
            className={inputClass}
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            Phone Number*
          </label>
          <input
            id="phone"
            className={inputClass}
            required
            value={phone}
            onChange={(event) => setPhone(cleanPhoneInput(event.target.value))}
            placeholder="03 123 456 or +961 71 123 456"
          />
        </div>

        <div>
          <label className={labelClass}>Birthday</label>
          <div className="grid grid-cols-[0.8fr_1.25fr_1fr] gap-2">
            <select className={inputClass} value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
              <option value="">Day</option>
              {dayOptions.map((day) => <option key={day}>{day}</option>)}
            </select>

            <select className={inputClass} value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
              <option value="">Month</option>
              {monthOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select className={inputClass} value={birthYear} onChange={(e) => setBirthYear(e.target.value)}>
              <option value="">Year</option>
              {yearOptions.map((year) => <option key={year}>{year}</option>)}
            </select>
          </div>
        </div>

        {questionsLoading ? (
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-sm font-bold text-white/75">
            Loading questions…
          </div>
        ) : null}

        {!questionsLoading
          ? questions.map((question) => {
              const value = answers[question.id];

              if (question.question_type === "rating") {
                return (
                  <StarRating
                    key={question.id}
                    label={question.question_text}
                    required={question.is_required}
                    value={Number(value ?? 0)}
                    onChange={(nextValue) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: nextValue,
                      }))
                    }
                  />
                );
              }

              if (question.question_type === "select") {
                const selected = String(value ?? "");
                return (
                  <div key={question.id}>
                    <label className={labelClass}>
                      {question.question_text}
                      {question.is_required ? "*" : ""}
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpenSelectId(question.id)}
                      className={`${inputClass} flex items-center justify-between text-left ${
                        selected ? "text-[#182f38]" : "text-[#182f38]/35"
                      }`}
                    >
                      <span>{selected || "Select one"}</span>
                      <span>⌄</span>
                    </button>
                  </div>
                );
              }

              return (
                <div key={question.id}>
                  <label className={labelClass}>
                    {question.question_text}
                    {question.is_required ? "*" : ""}
                  </label>
                  <textarea
                    className={`${inputClass} min-h-[120px] resize-none`}
                    value={String(value ?? "")}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                    placeholder="Write your answer here..."
                  />
                </div>
              );
            })
          : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || questionsLoading}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd66b] px-4 py-3.5 text-sm font-black uppercase text-[#182f38] disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>

      {openSelectId ? (() => {
        const question = questions.find((item) => item.id === openSelectId);
        if (!question) return null;

        return (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/45 px-4 pb-4 pt-10 backdrop-blur-sm"
            onClick={() => setOpenSelectId(null)}
          >
            <div
              className="w-full rounded-[28px] bg-white p-4 pb-5 text-[#182f38]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[18px] font-black">
                  {question.question_text}
                </h2>
                <button type="button" onClick={() => setOpenSelectId(null)}>×</button>
              </div>

              <div className="space-y-2">
                {(question.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option,
                      }));
                      setOpenSelectId(null);
                    }}
                    className="flex w-full rounded-2xl bg-[#f3f3f0] px-4 py-4 text-left text-[15px] font-black"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })() : null}

      {thankYouOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6 py-8 backdrop-blur-sm"
          onClick={() => setThankYouOpen(false)}
        >
          <div
            className="relative w-full max-w-[330px] rounded-[28px] bg-white px-6 pb-6 pt-7 text-center text-[#182f38]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setThankYouOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white"
            >
              ×
            </button>

            <img src="/thank-you.gif" alt="Thank you" className="mx-auto mb-4 h-24 w-24 object-contain" />

            <h2 className="text-[26px] font-black">Thanks for your review!</h2>

            <p className="mx-auto mt-4 max-w-[255px] text-[15px] font-bold leading-6 text-[#182f38]/78">
              Your feedback helps us improve every visit.
              <br /><br />
              Want to collect gifts at PRO’s Cafe?
            </p>

            <Link
              href="/register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd66b] px-4 py-3.5 text-sm font-black uppercase text-[#182f38]"
            >
              Join PRO’s Club
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
