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
};

type Ratings = {
  experience: number;
  food: number;
  service: number;
  clean: number;
  visitAgain: number;
};

type NormalizedPhoneResult =
  | { valid: true; value: string }
  | { valid: false; message: string };

const LEBANON_PHONE_PREFIXES = [
  "1",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "70",
  "71",
  "76",
  "78",
  "79",
  "81",
];

const FALLBACK_QUESTIONS: CommentCardQuestion[] = [
  {
    id: "experience_rating",
    question_key: "experience_rating",
    question_text: "How was your experience?",
    question_type: "rating",
    is_active: true,
    is_required: true,
    sort_order: 10,
    options: [],
  },
  {
    id: "food_rating",
    question_key: "food_rating",
    question_text: "How was the food?",
    question_type: "rating",
    is_active: true,
    is_required: true,
    sort_order: 20,
    options: [],
  },
  {
    id: "service_rating",
    question_key: "service_rating",
    question_text: "How was the service?",
    question_type: "rating",
    is_active: true,
    is_required: true,
    sort_order: 30,
    options: [],
  },
  {
    id: "cleanliness_rating",
    question_key: "cleanliness_rating",
    question_text: "Was the place clean?",
    question_type: "rating",
    is_active: true,
    is_required: true,
    sort_order: 40,
    options: [],
  },
  {
    id: "visit_again_rating",
    question_key: "visit_again_rating",
    question_text: "Would you visit again?",
    question_type: "rating",
    is_active: true,
    is_required: true,
    sort_order: 50,
    options: [],
  },
  {
    id: "heard_about_us",
    question_key: "heard_about_us",
    question_text: "How did you hear about us?",
    question_type: "select",
    is_active: true,
    is_required: true,
    sort_order: 60,
    options: ["Social Media", "Friend or Family", "Google", "Other"],
  },
  {
    id: "comments",
    question_key: "comments",
    question_text: "Any comments or suggestions?",
    question_type: "textarea",
    is_active: true,
    is_required: false,
    sort_order: 70,
    options: [],
  },
];

function normalizeLebanonPhone(rawValue: string): NormalizedPhoneResult {
  const value = rawValue.trim();

  if (!value) {
    return { valid: false, message: "Please enter a phone number." };
  }

  if (/[^\d\s()+-]/.test(value)) {
    return {
      valid: false,
      message:
        "Phone number can only contain numbers, spaces, +, -, and parentheses.",
    };
  }

  const compact = value.replace(/[\s()-]/g, "");

  if (
    (compact.match(/\+/g) || []).length > 1 ||
    (compact.includes("+") && !compact.startsWith("+"))
  ) {
    return { valid: false, message: "Please enter a valid phone number." };
  }

  const digitsOnly = compact.replace(/\D/g, "");

  if (
    digitsOnly.length < 7 ||
    digitsOnly.length > 11 ||
    /^(\d)\1+$/.test(digitsOnly)
  ) {
    return { valid: false, message: "Please enter a real phone number." };
  }

  let localNumber = "";

  if (compact.startsWith("+961")) {
    localNumber = compact.slice(4);
  } else if (digitsOnly.startsWith("961")) {
    localNumber = digitsOnly.slice(3);
  } else {
    localNumber = digitsOnly;
  }

  if (localNumber.startsWith("0")) {
    localNumber = localNumber.slice(1);
  }

  const hasValidLength =
    localNumber.length === 7 || localNumber.length === 8;
  const hasValidPrefix = LEBANON_PHONE_PREFIXES.some((prefix) =>
    localNumber.startsWith(prefix),
  );

  if (
    !hasValidLength ||
    !hasValidPrefix ||
    /^(\d)\1+$/.test(localNumber)
  ) {
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
  onChange: (nextValue: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/12 px-4 py-3.5 backdrop-blur-sm">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
        {label}
        {required ? "*" : ""}
      </div>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const selected = star <= value;

          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              aria-label={`${label} ${star} star${star === 1 ? "" : "s"}`}
              className={`text-[31px] leading-none transition ${
                selected ? "text-[#ffd66b]" : "text-white/38"
              } hover:scale-110 hover:text-[#ffd66b]`}
            >
              ★
            </button>
          );
        })}

        {value ? (
          <span className="ml-2 text-[12px] font-black text-white/80">
            {value}/5
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ratingKeyForQuestion(questionKey: string): keyof Ratings | null {
  if (questionKey === "experience_rating") return "experience";
  if (questionKey === "food_rating") return "food";
  if (questionKey === "service_rating") return "service";
  if (questionKey === "cleanliness_rating") return "clean";
  if (questionKey === "visit_again_rating") return "visitAgain";
  return null;
}

export function CommentCardForm() {
  const supabase = useMemo(() => createClient(), []);

  const [questions, setQuestions] =
    useState<CommentCardQuestion[]>(FALLBACK_QUESTIONS);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState("");
  const [comments, setComments] = useState("");

  const dayOptions = Array.from({ length: 31 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );

  const monthOptions = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const currentYear = new Date().getFullYear();

  const yearOptions = Array.from({ length: 90 }, (_, index) =>
    String(currentYear - index),
  );

  const [ratings, setRatings] = useState<Ratings>({
    experience: 0,
    food: 0,
    service: 0,
    clean: 0,
    visitAgain: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const [hearSheetOpen, setHearSheetOpen] = useState(false);

  const inputClass =
    "w-full rounded-xl border border-white/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#182f38] outline-none transition placeholder:text-[#182f38]/35 focus:border-[#ffd66b]/80 focus:ring-4 focus:ring-[#ffd66b]/20";

  const labelClass =
    "mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-white";

  const activeQuestions = useMemo(
    () =>
      questions
        .filter((question) => question.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [questions],
  );

  const heardQuestion = activeQuestions.find(
    (question) => question.question_key === "heard_about_us",
  );

  const hearOptions =
    heardQuestion && Array.isArray(heardQuestion.options)
      ? heardQuestion.options
      : [];

  function updateRating(key: keyof Ratings, value: number) {
    setRatings((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        const response = await fetch("/api/comment-card-questions", {
          cache: "no-store",
        });

        const json = (await response.json().catch(() => ({}))) as {
          questions?: CommentCardQuestion[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            json.error || "Could not load comment card questions.",
          );
        }

        if (cancelled) return;

        const loadedQuestions = Array.isArray(json.questions)
          ? json.questions
          : [];

        setQuestions(
          loadedQuestions.length ? loadedQuestions : FALLBACK_QUESTIONS,
        );
      } catch (queryError) {
        if (cancelled) return;

        console.error("Could not load comment card questions:", queryError);
        setQuestions(FALLBACK_QUESTIONS);
      } finally {
        if (!cancelled) {
          setQuestionsLoading(false);
        }
      }
    }

    void loadQuestions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hearSheetOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHearSheetOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [hearSheetOpen]);

  function resetForm() {
    setFullName("");
    setPhone("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setHearAboutUs("");
    setComments("");
    setRatings({
      experience: 0,
      food: 0,
      service: 0,
      clean: 0,
      visitAgain: 0,
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    for (const question of activeQuestions) {
      if (!question.is_required) continue;

      const ratingKey = ratingKeyForQuestion(question.question_key);

      if (question.question_type === "rating" && ratingKey) {
        if (!ratings[ratingKey]) {
          setError(`Please answer: ${question.question_text}`);
          return;
        }
      }

      if (
        question.question_key === "heard_about_us" &&
        !hearAboutUs
      ) {
        setError(`Please answer: ${question.question_text}`);
        return;
      }

      if (
        question.question_key === "comments" &&
        !comments.trim()
      ) {
        setError(`Please answer: ${question.question_text}`);
        return;
      }
    }

    const phoneResult = normalizeLebanonPhone(phone);

    if (phoneResult.valid === false) {
      setError(phoneResult.message);
      return;
    }

    setLoading(true);

    const birthdayValue =
      birthDay && birthMonth && birthYear
        ? `${birthYear}-${birthMonth}-${birthDay}`
        : null;

    const activeKeys = new Set(
      activeQuestions.map((question) => question.question_key),
    );

    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      phone: phoneResult.value,
      birthday: birthdayValue,
      experience_rating: activeKeys.has("experience_rating")
        ? ratings.experience || null
        : null,
      food_rating: activeKeys.has("food_rating")
        ? ratings.food || null
        : null,
      service_rating: activeKeys.has("service_rating")
        ? ratings.service || null
        : null,
      cleanliness_rating: activeKeys.has("cleanliness_rating")
        ? ratings.clean || null
        : null,
      visit_again_rating: activeKeys.has("visit_again_rating")
        ? ratings.visitAgain || null
        : null,
      heard_about_us: activeKeys.has("heard_about_us")
        ? hearAboutUs || null
        : null,
      comments: activeKeys.has("comments")
        ? comments.trim() || null
        : null,
    };

    const { error: insertError } = await supabase
      .from("comment_cards")
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    resetForm();
    setInfo(null);
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
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
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
            onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
            placeholder="03 123 456 or +961 71 123 456"
            autoComplete="tel"
            inputMode="tel"
            minLength={7}
            maxLength={20}
            pattern="[0-9\s()+-]{7,20}"
            title="Enter a real Lebanese phone number, e.g. 03 123 456 or +961 71 123 456"
          />
        </div>

        <div>
          <label className={labelClass}>Birthday</label>
          <div className="grid grid-cols-[0.8fr_1.25fr_1fr] gap-2">
            <select
              className={inputClass}
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              aria-label="Birthday day"
            >
              <option value="">Day</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <select
              className={inputClass}
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              aria-label="Birthday month"
            >
              <option value="">Month</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              className={inputClass}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              aria-label="Birthday year"
            >
              <option value="">Year</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {questionsLoading ? (
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-sm font-bold text-white/75">
            Loading questions…
          </div>
        ) : null}

        {!questionsLoading
          ? activeQuestions.map((question) => {
              const ratingKey = ratingKeyForQuestion(
                question.question_key,
              );

              if (
                question.question_type === "rating" &&
                ratingKey
              ) {
                return (
                  <StarRating
                    key={question.id}
                    label={question.question_text}
                    required={question.is_required}
                    value={ratings[ratingKey]}
                    onChange={(value) =>
                      updateRating(ratingKey, value)
                    }
                  />
                );
              }

              if (
                question.question_type === "select" &&
                question.question_key === "heard_about_us"
              ) {
                return (
                  <div key={question.id}>
                    <label
                      className={labelClass}
                      htmlFor="heard_about_us_button"
                    >
                      {question.question_text}
                      {question.is_required ? "*" : ""}
                    </label>

                    <button
                      id="heard_about_us_button"
                      type="button"
                      className={`${inputClass} flex items-center justify-between text-left ${
                        hearAboutUs
                          ? "text-[#182f38]"
                          : "text-[#182f38]/35"
                      }`}
                      onClick={() => setHearSheetOpen(true)}
                      aria-haspopup="dialog"
                      aria-expanded={hearSheetOpen}
                    >
                      <span>{hearAboutUs || "Select one"}</span>
                      <span className="text-[16px] leading-none text-[#182f38]">
                        ⌄
                      </span>
                    </button>
                  </div>
                );
              }

              if (
                question.question_type === "textarea" &&
                question.question_key === "comments"
              ) {
                return (
                  <div key={question.id}>
                    <label className={labelClass} htmlFor="comments">
                      {question.question_text}
                      {question.is_required ? "*" : ""}
                    </label>
                    <textarea
                      id="comments"
                      className={`${inputClass} min-h-[120px] resize-none`}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Write your comments here..."
                      required={question.is_required}
                    />
                  </div>
                );
              }

              return null;
            })
          : null}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm font-bold text-emerald-800">
            {info}
          </div>
        )}

        <button
          type="submit"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd66b] px-4 py-3.5 text-sm font-black uppercase tracking-[0.02em] text-[#182f38] transition hover:bg-[#f3c95e] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
          disabled={loading || questionsLoading}
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>

      {hearSheetOpen && heardQuestion ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 px-4 pb-4 pt-10 backdrop-blur-sm"
          onClick={() => setHearSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={heardQuestion.question_text}
        >
          <div
            className="w-full rounded-[28px] bg-white p-4 pb-5 text-[#182f38] shadow-[0_-18px_70px_rgba(0,0,0,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#182f38]/18" />

            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-raleway text-[18px] font-black tracking-[-0.03em] text-[#182f38]">
                {heardQuestion.question_text}
              </h2>
              <button
                type="button"
                onClick={() => setHearSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#182f38] text-[16px] font-black leading-none text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {hearOptions.map((option) => {
                const selected = hearAboutUs === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setHearAboutUs(option);
                      setHearSheetOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left text-[15px] font-black transition ${
                      selected
                        ? "bg-[#ffd66b] text-[#182f38]"
                        : "bg-[#f3f3f0] text-[#182f38] active:scale-[0.99]"
                    }`}
                  >
                    <span>{option}</span>
                    {selected ? (
                      <span className="text-[18px] leading-none">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {thankYouOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6 py-8 backdrop-blur-sm"
          onClick={() => setThankYouOpen(false)}
        >
          <div
            className="relative w-full max-w-[330px] rounded-[28px] bg-white px-6 pb-6 pt-7 text-center text-[#182f38] shadow-[0_24px_80px_rgba(0,0,0,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setThankYouOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black text-[16px] font-black leading-none text-white"
              aria-label="Close"
            >
              ×
            </button>

            <img
              src="/thank-you.gif"
              alt="Thank you"
              className="mx-auto mb-4 h-24 w-24 object-contain"
            />

            <h2 className="font-raleway text-[26px] font-black leading-[1.05] tracking-[-0.04em] text-[#182f38]">
              Thanks for your review!
            </h2>

            <p className="mx-auto mt-4 max-w-[255px] text-[15px] font-bold leading-6 text-[#182f38]/78">
              Your feedback helps us improve every visit.
              <br />
              <br />
              Want to collect gifts at PRO’s Cafe?
            </p>

            <Link
              href="/register"
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#ffd66b] px-4 py-3.5 text-sm font-black uppercase tracking-[0.02em] text-[#182f38] transition hover:bg-[#f3c95e] active:scale-[0.99]"
            >
              Join PRO’s Club
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
