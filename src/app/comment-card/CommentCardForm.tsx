"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const HEAR_OPTIONS = [
  "Social Media",
  "Friend or Family",
  "Google",
  "Other",
] as const;

type HearOption = "" | (typeof HEAR_OPTIONS)[number];

type Ratings = {
  experience: number;
  food: number;
  service: number;
  clean: number;
  visitAgain: number;
};

type NormalizedPhoneResult = { valid: true; value: string } | { valid: false; message: string };

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

function normalizeLebanonPhone(rawValue: string): NormalizedPhoneResult {
  const value = rawValue.trim();

  if (!value) {
    return { valid: false, message: "Please enter a phone number." };
  }

  if (/[^\d\s()+-]/.test(value)) {
    return {
      valid: false,
      message: "Phone number can only contain numbers, spaces, +, -, and parentheses.",
    };
  }

  const compact = value.replace(/[\s()-]/g, "");

  if ((compact.match(/\+/g) || []).length > 1 || (compact.includes("+") && !compact.startsWith("+"))) {
    return { valid: false, message: "Please enter a valid phone number." };
  }

  const digitsOnly = compact.replace(/\D/g, "");

  if (digitsOnly.length < 7 || digitsOnly.length > 11 || /^(\d)\1+$/.test(digitsOnly)) {
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

  const hasValidLength = localNumber.length === 7 || localNumber.length === 8;
  const hasValidPrefix = LEBANON_PHONE_PREFIXES.some((prefix) => localNumber.startsWith(prefix));

  if (!hasValidLength || !hasValidPrefix || /^(\d)\1+$/.test(localNumber)) {
    return {
      valid: false,
      message: "Please enter a valid Lebanese phone number, e.g. 03 123 456 or +961 71 123 456.",
    };
  }

  return { valid: true, value: `+961${localNumber}` };
}

function cleanPhoneInput(value: string) {
  return value.replace(/[^\d\s()+-]/g, "");
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/12 px-4 py-3.5 backdrop-blur-sm">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
        {label}
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

export function CommentCardForm() {
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [hearAboutUs, setHearAboutUs] = useState<HearOption>("");
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

  function updateRating(key: keyof Ratings, value: number) {
    setRatings((current) => ({ ...current, [key]: value }));
  }

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

    const missingRating = Object.values(ratings).some((rating) => rating === 0);

    if (missingRating) {
      setError("Please select stars for all questions.");
      return;
    }

    if (!hearAboutUs) {
      setError("Please choose how you heard about us.");
      return;
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

    const { error: insertError } = await supabase.from("comment_cards").insert({
      full_name: fullName.trim(),
      phone: phoneResult.value,
      birthday: birthdayValue,
      experience_rating: ratings.experience,
      food_rating: ratings.food,
      service_rating: ratings.service,
      cleanliness_rating: ratings.clean,
      visit_again_rating: ratings.visitAgain,
      heard_about_us: hearAboutUs,
      comments: comments.trim() || null,
    });

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

        <StarRating
          label="How was your experience?"
          value={ratings.experience}
          onChange={(value) => updateRating("experience", value)}
        />

        <StarRating
          label="How was the food?"
          value={ratings.food}
          onChange={(value) => updateRating("food", value)}
        />

        <StarRating
          label="How was the service?"
          value={ratings.service}
          onChange={(value) => updateRating("service", value)}
        />

        <StarRating
          label="Was the place clean?"
          value={ratings.clean}
          onChange={(value) => updateRating("clean", value)}
        />

        <StarRating
          label="Would you visit again?"
          value={ratings.visitAgain}
          onChange={(value) => updateRating("visitAgain", value)}
        />

        <div>
          <label className={labelClass} htmlFor="heard_about_us_button">
            How did you hear about us?
          </label>

          <button
            id="heard_about_us_button"
            type="button"
            className={`${inputClass} flex items-center justify-between text-left ${
              hearAboutUs ? "text-[#182f38]" : "text-[#182f38]/35"
            }`}
            onClick={() => setHearSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={hearSheetOpen}
          >
            <span>{hearAboutUs || "Select one"}</span>
            <span className="text-[16px] leading-none text-[#182f38]">⌄</span>
          </button>
        </div>

        <div>
          <label className={labelClass} htmlFor="comments">
            Any comments or suggestions?
          </label>
          <textarea
            id="comments"
            className={`${inputClass} min-h-[120px] resize-none`}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Write your comments here..."
          />
        </div>

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
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Feedback"}
        </button>
      </form>

      {hearSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/45 px-4 pb-4 pt-10 backdrop-blur-sm"
          onClick={() => setHearSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Choose how you heard about us"
        >
          <div
            className="w-full rounded-[28px] bg-white p-4 pb-5 text-[#182f38] shadow-[0_-18px_70px_rgba(0,0,0,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#182f38]/18" />

            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-raleway text-[18px] font-black tracking-[-0.03em] text-[#182f38]">
                How did you hear about us?
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
              {HEAR_OPTIONS.map((option) => {
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
