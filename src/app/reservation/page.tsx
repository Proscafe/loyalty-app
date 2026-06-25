"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Plus,
  Star,
  Ticket,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import AdminMobileHeader from "@/components/AdminMobileHeader";

type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  dateLabel: string;
  timeLabel: string;
  seats: string;
  price: string;
  image: string;
  guests: string;
  tables: string;
  pinned?: boolean;
};

type Reservation = {
  id: string;
  time: string;
  fullName: string;
  phone: string;
  guests: number;
  table: string;
  status: "Confirmed" | "Late" | "No Show" | "Pending";
};

const upcomingEvents: EventItem[] = [
  {
    id: "rayfoun-live-night",
    title: "Rayfoun Live Night",
    subtitle: "Dinner, drinks, music, and mountain views",
    description:
      "Reserve a table for a relaxed PRO's Rayfoun evening with food, drinks, music, and mountain views.",
    dateLabel: "Tue 13",
    timeLabel: "17:00",
    seats: "42 seats left",
    price: "Free entry",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    guests: "42 guests",
    tables: "5/20 tables",
    pinned: true,
  },
  {
    id: "sunset-dinner",
    title: "Sunset Dinner",
    subtitle: "Golden hour terrace reservations",
    description:
      "A cozy dinner setup for friends, families, and groups on the Rayfoun terrace.",
    dateLabel: "Thu 25",
    timeLabel: "20:30",
    seats: "18 seats left",
    price: "Reservation only",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    guests: "18 guests",
    tables: "8/20 tables",
  },
  {
    id: "football-night",
    title: "Football Night",
    subtitle: "Big screen match night",
    description:
      "Book your table for game night with food, drinks, and PRO's match atmosphere.",
    dateLabel: "Fri 26",
    timeLabel: "22:00",
    seats: "24 seats left",
    price: "Free entry",
    image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
    guests: "24 guests",
    tables: "11/20 tables",
  },
];

const reservations: Reservation[] = [
  {
    id: "r1",
    time: "10:00",
    fullName: "Wissam Mantoufeh",
    phone: "76 720 277",
    guests: 4,
    table: "Indoor 12",
    status: "Confirmed",
  },
  {
    id: "r2",
    time: "12:30",
    fullName: "Rony Haddad",
    phone: "03 445 122",
    guests: 8,
    table: "VIP Sofa",
    status: "Late",
  },
  {
    id: "r3",
    time: "15:00",
    fullName: "Maya Karam",
    phone: "71 840 221",
    guests: 3,
    table: "Terrace 5",
    status: "Pending",
  },
  {
    id: "r4",
    time: "20:30",
    fullName: "Karim Saab",
    phone: "81 112 774",
    guests: 6,
    table: "Lounge 3",
    status: "No Show",
  },
  {
    id: "r5",
    time: "23:00",
    fullName: "Nour Hajj",
    phone: "70 665 901",
    guests: 5,
    table: "Indoor 9",
    status: "Confirmed",
  },
];

function formatDateButton(date: Date) {
  return {
    weekday: date
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
    day: date.getDate().toString(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    value: date.toISOString().slice(0, 10),
  };
}

function buildDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);
  end.setMonth(today.getMonth() + 2);
  const dates = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatDateButton(new Date(d)));
  }
  return dates;
}

function getCurrentTimeSlot() {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
  let hour = now.getHours();
  let minutes = roundedMinutes;

  if (minutes === 60) {
    hour += 1;
    minutes = 0;
  }

  return `${hour % 24}:${minutes}`;
}

function formatTimeLabel(hour24: number, mins: number) {
  return `${String(hour24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function buildTimes() {
  const items: Array<{ label: string; value: string }> = [];
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
  let startHour = now.getHours();
  let startMinutes = roundedMinutes;

  if (startMinutes === 60) {
    startHour += 1;
    startMinutes = 0;
  }

  const start = startHour * 60 + startMinutes;
  const end = start + 16 * 60;

  for (let totalMinutes = start; totalMinutes <= end; totalMinutes += 30) {
    const hour24 = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    items.push({
      label: formatTimeLabel(hour24, mins),
      value: `${hour24}:${mins}`,
    });
  }

  return items;
}

function scrollByAmount(
  ref: React.RefObject<HTMLDivElement | null>,
  direction: "left" | "right",
) {
  ref.current?.scrollBy({
    left: direction === "left" ? -360 : 360,
    behavior: "smooth",
  });
}

function buildMonthDays(selectedDate: string) {
  const base = new Date(`${selectedDate}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const cells: Array<{ key: string; day: number | null; total: number; dateValue?: string }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ key: `empty-${i}`, day: null, total: 0 });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const total = reservations.filter((reservation) => {
      const reservationDay = Number(reservation.id.replace(/\D/g, "")) || 1;
      return ((reservationDay + day) % 5) + 1 > 3 ? day % 4 : day % 3;
    }).length;
    const dateValue = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ key: dateValue, day, total, dateValue });
  }

  return cells;
}

function getMonthTitle(selectedDate: string) {
  return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function moveMonth(selectedDate: string, direction: "previous" | "next") {
  const current = new Date(`${selectedDate}T00:00:00`);
  current.setMonth(current.getMonth() + (direction === "next" ? 1 : -1));
  return current.toISOString().slice(0, 10);
}

export default function ReservationPage() {
  const dates = useMemo(() => buildDateRange(), []);
  const times = useMemo(() => buildTimes(), []);
  const todayValue = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [selectedTime, setSelectedTime] = useState(() => getCurrentTimeSlot());
  const [activeSection, setActiveSection] = useState<"bookings" | "events">("bookings");
  const [reservationView, setReservationView] = useState<"table" | "month">("table");
  const [eventsOpen, setEventsOpen] = useState(true);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const selectedDateButton = dateRef.current?.querySelector<HTMLButtonElement>(
      `[data-date-value="${selectedDate}"]`,
    );

    selectedDateButton?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedDate]);

  const selectedDateLabel = useMemo(() => {
    const found = dates.find((date) => date.value === selectedDate);
    if (found) return `${found.weekday} ${found.day} ${found.month}`;
    const parsed = new Date(`${selectedDate}T00:00:00`);
    return parsed
      .toLocaleDateString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
      .toUpperCase();
  }, [dates, selectedDate]);

  const monthDays = useMemo(() => buildMonthDays(selectedDate), [selectedDate]);
  const monthTitle = useMemo(() => getMonthTitle(selectedDate), [selectedDate]);
  const totalGuests = useMemo(
    () => reservations.reduce((sum, reservation) => sum + reservation.guests, 0),
    [],
  );
  const totalTables = useMemo(
    () => new Set(reservations.map((reservation) => reservation.table)).size,
    [],
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf5ef] font-[Raleway,Arial,sans-serif] text-[#22110f]">
      <style jsx global>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,217,82,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(166,93,82,0.15),transparent_26%),linear-gradient(135deg,#fff8f1_0%,#fbf2eb_46%,#f5e4dc_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-3 sm:px-8 lg:px-14 lg:py-5">
        <div className="mb-4 overflow-hidden rounded-[30px] border border-white/25 bg-gradient-to-r from-[#893b35] via-[#a65d52] to-[#c0735e] shadow-xl shadow-[#5f2b26]/15 lg:mb-6">
          <AdminMobileHeader />
        </div>

        <section className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-5">
          <div>
            <h1 className="text-[36px] font-black leading-[0.95] tracking-[-0.055em] text-[#351614] sm:text-[44px] lg:text-[50px]">
              Reservation
            </h1>
            <p className="mt-2 max-w-[560px] text-[16px] font-medium leading-relaxed text-[#6b5651] sm:text-[17px]">
              Manage reservations, events, and table bookings.
            </p>

            <div className="mt-4 inline-flex rounded-[18px] border border-[#ead6ce] bg-white/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveSection("bookings")}
                className={`rounded-[14px] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] transition ${activeSection === "bookings" ? "bg-[#ffdb57] text-[#2b211f] shadow-md shadow-[#d6a83f]/20" : "text-[#6b5651] hover:bg-white"}`}
              >
                Bookings
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("events")}
                className={`rounded-[14px] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] transition ${activeSection === "events" ? "bg-[#ffdb57] text-[#2b211f] shadow-md shadow-[#d6a83f]/20" : "text-[#6b5651] hover:bg-white"}`}
              >
                Events
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden h-12 w-12 place-items-center rounded-[16px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57] lg:grid"
              aria-label="Upload reservations"
            >
              <Upload size={18} />
            </button>
            <button className="inline-flex w-fit items-center gap-3 rounded-[18px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02] lg:px-6">
              Add Reservation
              <Plus size={19} />
            </button>
          </div>
        </section>

        <section className="mb-5 rounded-[24px] border border-[#ead6ce] bg-white/86 p-4 text-[#22110f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md lg:p-5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[21px] font-black tracking-[-0.035em] text-[#2b211f]">
                Select date &amp; time
              </h2>
              <p className="mt-1 text-[12px] font-bold text-[#8a746f]">
                Choose when the reservation or event will happen.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-2xl border border-[#e6cec5] bg-[#fff7f1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#5a302b]">
                {selectedDateLabel}
              </span>
            </div>
          </div>

          <div className="relative mb-5 flex items-center gap-3 border-b border-[#eadbd6] pb-5">
            <button
              type="button"
              onClick={() => scrollByAmount(dateRef, "left")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
              aria-label="Previous dates"
            >
              <ChevronLeft size={21} />
            </button>

            <div
              ref={dateRef}
              className="hide-scrollbar flex flex-1 gap-4 overflow-x-auto scroll-smooth py-1"
            >
              {dates.map((date) => {
                const active = date.value === selectedDate;
                return (
                  <button
                    key={date.value}
                    type="button"
                    data-date-value={date.value}
                    onClick={() => setSelectedDate(date.value)}
                    className={`min-w-[82px] rounded-[18px] border px-3 py-3 text-center transition ${active ? "border-[#ffdb57] bg-[#ffdb57] text-[#2b211f] shadow-lg shadow-[#e6bc40]/25" : "border-[#e7cfc7] bg-white/75 text-[#2b211f] hover:border-[#ffdb57] hover:bg-[#fff8dd]"}`}
                  >
                    <span className="block text-[11px] font-black uppercase tracking-[0.06em]">
                      {date.weekday}
                    </span>
                    <span className="mt-2 block text-[24px] font-black leading-none tracking-[-0.04em]">
                      {date.day}
                    </span>
                    <span className="mt-2 block text-[12px] font-black uppercase tracking-[0.08em]">
                      {date.month}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollByAmount(dateRef, "right")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
              aria-label="Next dates"
            >
              <ChevronRight size={21} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => scrollByAmount(timeRef, "left")}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57] sm:grid"
              aria-label="Previous times"
            >
              <ChevronLeft size={21} />
            </button>

            <div
              ref={timeRef}
              className="hide-scrollbar flex flex-1 gap-4 overflow-x-auto scroll-smooth py-1"
            >
              {times.map((time) => {
                const active = time.value === selectedTime;
                return (
                  <button
                    key={time.value}
                    type="button"
                    onClick={() => setSelectedTime(time.value)}
                    className={`min-w-[92px] rounded-[16px] border px-4 py-3 text-[14px] font-black transition ${active ? "border-[#ffdb57] bg-[#ffdb57] text-[#2b211f] shadow-lg shadow-[#e6bc40]/25" : "border-[#ead6ce] bg-white/75 text-[#2b211f] hover:border-[#ffdb57] hover:bg-[#fff8dd]"}`}
                  >
                    {time.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollByAmount(timeRef, "right")}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57] sm:grid"
              aria-label="Next times"
            >
              <ChevronRight size={21} />
            </button>
          </div>
        </section>

        {activeSection === "events" ? (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[28px] font-black tracking-[-0.05em] text-[#2b211f]">
              Events
            </h2>
            <button
              type="button"
              onClick={() => setEventsOpen((value) => !value)}
              className="inline-flex items-center gap-2 text-[13px] font-black text-[#5a302b]"
            >
              View all
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#5a302b]">
                {eventsOpen ? (
                  <ChevronUp size={17} />
                ) : (
                  <ChevronDown size={17} />
                )}
              </span>
            </button>
          </div>

          {eventsOpen ? (
            <div className="hide-scrollbar flex gap-6 overflow-x-auto pb-2">
              {upcomingEvents.map((event) => {
                const [eventDayName = "", eventDay = ""] =
                  event.dateLabel.split(" ");
                return (
                  <article
                    key={event.id}
                    className="relative flex min-w-[390px] max-w-[390px] overflow-hidden rounded-[28px] bg-gradient-to-br from-[#9a3f38] via-[#b96955] to-[#c27b60] p-7 text-white shadow-xl shadow-[#9a5048]/15 sm:min-w-[460px] sm:max-w-[460px]"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_18%,rgba(255,219,87,0.18),transparent_30%)]" />
                    <div className="relative grid h-[116px] w-[88px] shrink-0 place-items-center rounded-[24px] bg-[#ffdb57] text-center text-[#2b211f] shadow-lg shadow-black/10">
                      <div>
                        <span className="block text-[13px] font-black uppercase leading-none">
                          {eventDayName}
                        </span>
                        <span className="mt-2 block text-[38px] font-black leading-none tracking-[-0.06em]">
                          {eventDay}
                        </span>
                        <span className="mt-2 block text-[13px] font-black uppercase leading-none">
                          JUN
                        </span>
                      </div>
                    </div>

                    <div className="relative ml-6 min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="line-clamp-1 text-[24px] font-black leading-tight tracking-[-0.04em]">
                          {event.title}
                        </h3>
                        <Star
                          size={25}
                          fill={event.pinned ? "#ffdb57" : "none"}
                          className="mt-1 shrink-0 text-[#ffdb57]"
                        />
                      </div>

                      <p className="mt-2 line-clamp-2 text-[17px] font-semibold leading-snug text-white/88">
                        {event.subtitle}
                      </p>

                      <div className="mt-8 grid grid-cols-3 gap-3 text-[14px] font-black text-white/95">
                        <span className="flex items-center gap-2">
                          <Clock size={18} className="text-[#ffdb57]" />
                          {event.timeLabel}
                        </span>
                        <span className="flex items-center gap-2">
                          <Users size={18} className="text-[#ffdb57]" />
                          {event.guests}
                        </span>
                        <span className="flex items-center gap-2">
                          <Ticket size={18} className="text-[#ffdb57]" />
                          {event.tables}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
        ) : null}

        {activeSection === "bookings" ? (
        <section className="mb-10 overflow-hidden rounded-[26px] border border-[#ead6ce] bg-white/88 text-[#2b211f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md">
          <div className="flex flex-col gap-4 border-b border-[#eadbd6] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div>
              <h2 className="text-[28px] font-black tracking-[-0.05em]">
                Bookings
              </h2>
              <p className="mt-1 text-[12px] font-black uppercase tracking-[0.1em] text-[#8a746f]">
                {totalGuests} guests · {totalTables} tables
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-[16px] border border-[#ead6ce] bg-[#fff7f1] p-1">
                <button
                  type="button"
                  onClick={() => setReservationView("table")}
                  className={`rounded-[12px] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${reservationView === "table" ? "bg-[#ffdb57] text-[#2b211f]" : "text-[#6b5651] hover:bg-white"}`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setReservationView("month")}
                  className={`rounded-[12px] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${reservationView === "month" ? "bg-[#ffdb57] text-[#2b211f]" : "text-[#6b5651] hover:bg-white"}`}
                >
                  Month view
                </button>
              </div>
            </div>
          </div>

          {reservationView === "table" ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[560px] w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="bg-[#f5ebe5] text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                      <th className="w-[54px] px-2 py-3">Time</th>
                      <th className="w-[120px] px-2 py-3">Full Name</th>
                      <th className="w-[92px] px-2 py-3">Phone</th>
                      <th className="w-[34px] px-1 py-3 text-center">#</th>
                      <th className="w-[76px] px-2 py-3">Table</th>
                      <th className="w-[136px] px-2 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eadbd6]">
                    {reservations.map((reservation) => (
                      <tr
                        key={reservation.id}
                        className="bg-white/50 transition hover:bg-[#fff8ec]"
                      >
                        <td className="px-2 py-2.5 text-[12.5px] font-black text-[#2b211f]">
                          {reservation.time}
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="truncate text-[12.5px] font-black leading-none text-[#2b211f]">
                            {reservation.fullName}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <a
                            href={`tel:${reservation.phone.replace(/\s/g, "")}`}
                            className="block truncate text-[12.5px] font-bold leading-none text-[#2b211f]"
                          >
                            {reservation.phone}
                          </a>
                        </td>
                        <td className="px-1 py-2.5 text-center text-[12.5px] font-black">
                          {reservation.guests}
                        </td>
                        <td className="px-2 py-2.5 text-[12.5px] font-black">
                          <span className="block truncate">{reservation.table}</span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <div className="mx-auto flex w-[124px] items-center justify-center gap-1">
                            <button
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ffe3df] text-[#c9453f] transition hover:scale-105"
                              aria-label={`Delete reservation for ${reservation.fullName}`}
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              className={`inline-flex min-w-[72px] items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[10px] font-bold ${reservation.status === "Confirmed" ? "bg-[#eaf7e2] text-[#315d2c]" : reservation.status === "Late" ? "bg-[#ffe9d9] text-[#b85e22]" : reservation.status === "No Show" ? "bg-[#ece8e5] text-[#6d625f]" : "bg-[#ffdb57] text-[#2b211f]"}`}
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${reservation.status === "Confirmed" ? "bg-[#5db84f]" : reservation.status === "Late" ? "bg-[#ee8a2f]" : reservation.status === "No Show" ? "bg-[#a79f9a]" : "bg-[#2b211f]"}`}
                              />
                              {reservation.status === "Pending"
                                ? "Confirm"
                                : reservation.status}
                            </button>
                            <button
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fff7f1] text-[#8f3f38] transition hover:bg-[#ffdb57]"
                              aria-label={`Open reservation for ${reservation.fullName}`}
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-4 border-t border-[#eadbd6] px-5 py-5 text-[14px] font-medium text-[#6b5651] sm:flex-row sm:items-center sm:justify-between lg:px-8">
                <p>Showing 1 to 5 of 25 reservations</p>
                <div className="flex items-center gap-2">
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white">
                    <ChevronLeft size={18} />
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffdb57] font-black text-[#2b211f]">
                    1
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white font-black">
                    2
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white font-black">
                    3
                  </button>
                  <span className="px-2 font-black">...</span>
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white font-black">
                    5
                  </button>
                  <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-5 lg:p-8">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDate((value) => moveMonth(value, "previous"))}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h3 className="min-w-[170px] text-center text-[24px] font-black tracking-[-0.04em] text-[#2b211f]">
                    {monthTitle}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedDate((value) => moveMonth(value, "next"))}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
                    aria-label="Next month"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 overflow-hidden rounded-[24px] border border-[#eadbd6] bg-white/70">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="border-b border-[#eadbd6] bg-[#f5ebe5] px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]"
                  >
                    {day}
                  </div>
                ))}

                {monthDays.map((cell) => {
                  const active = cell.day && Number(selectedDate.slice(-2)) === cell.day;
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={!cell.day}
                      onClick={() => {
                        if (!cell.dateValue) return;
                        setSelectedDate(cell.dateValue);
                        setReservationView("table");
                      }}
                      className={`relative min-h-[112px] border-b border-r border-[#eadbd6] p-3 transition ${cell.day ? "cursor-pointer bg-white/55 hover:bg-[#fff8dd]" : "cursor-default bg-[#fbf5ef]/70"} ${active ? "bg-[#fff4c8]" : ""}`}
                    >
                      {cell.day ? (
                        <>
                          <span className="absolute left-3 top-3 text-[15px] font-black text-[#2b211f]">
                            {cell.day}
                          </span>
                          <span
                            className={`mx-auto mt-7 grid h-14 w-14 place-items-center rounded-full text-[24px] font-black ${cell.total > 0 ? "bg-[#ffdb57] text-[#2b211f]" : "bg-[#f0e5df] text-[#8a746f]"}`}
                            aria-label={`${cell.total} reservations`}
                          >
                            {cell.total}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
        ) : null}

        <footer className="pb-8 text-center text-[14px] font-medium text-[#7a605a]">
          Need help?{" "}
          <span className="font-black text-[#9a5048]">Contact support</span>
        </footer>
      </div>
    </main>
  );
}
