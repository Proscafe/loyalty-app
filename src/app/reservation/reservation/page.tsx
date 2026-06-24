"use client";

import { useMemo, useRef, useState } from "react";
import AdminMobileHeader from "@/components/AdminMobileHeader";

type ReservationEvent = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  day: string;
  time: string;
  capacity: string;
  price: string;
  image: string;
  description: string;
  status: "Open" | "Few seats" | "Sold out";
};

const events: ReservationEvent[] = [
  {
    id: "rayfoun-live-night",
    title: "Rayfoun Live Night",
    subtitle: "Dinner, drinks, music, and mountain views",
    day: "Tue",
    date: "13",
    time: "17:00",
    capacity: "42 seats left",
    price: "Free entry",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85",
    description:
      "Reserve a table for a relaxed PRO's Rayfoun evening with food, drinks, music, and mountain views.",
    status: "Open",
  },
  {
    id: "burger-game-night",
    title: "Burger & Game Night",
    subtitle: "Big-screen match, burger combos, and table packages",
    day: "Wed",
    date: "14",
    time: "20:30",
    capacity: "18 seats left",
    price: "From 15$",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=85",
    description:
      "Book your game-night table with burger bundles, shared starters, and drinks packages.",
    status: "Few seats",
  },
  {
    id: "family-brunch",
    title: "Sunday Family Brunch",
    subtitle: "Family tables, kids corner, and brunch specials",
    day: "Sun",
    date: "18",
    time: "12:30",
    capacity: "30 seats left",
    price: "Menu pricing",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=85",
    description:
      "A comfortable Sunday brunch setup for families with easy table booking and highlighted menu specials.",
    status: "Open",
  },
  {
    id: "sunset-table",
    title: "Sunset Table Package",
    subtitle: "Reserve a private table with drinks and shareable bites",
    day: "Fri",
    date: "16",
    time: "19:00",
    capacity: "10 tables left",
    price: "Package pricing",
    image:
      "https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&w=1200&q=85",
    description:
      "A premium sunset table experience for groups, birthdays, and weekend gatherings.",
    status: "Open",
  },
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthDates(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return {
      key: dateKey(date),
      day: dayLabels[date.getDay()],
      num: `${date.getDate()}`,
      fullDate: date,
    };
  });
}

function getTimeSlots() {
  return Array.from({ length: 24 }, (_, hour) => `${hour}`.padStart(2, "0") + ":00");
}

const times = getTimeSlots();

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="m12 2.8 2.82 5.72 6.31.92-4.57 4.46 1.08 6.28L12 17.21l-5.64 2.97 1.08-6.28-4.57-4.46 6.31-.92L12 2.8Z"
        className={filled ? "fill-[#f7d657]" : "fill-none stroke-current stroke-[1.8]"}
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v12A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-12A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm13 8H4v8.5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5V10ZM4.5 6a.5.5 0 0 0-.5.5V8h16V6.5a.5.5 0 0 0-.5-.5h-15Z" />
    </svg>
  );
}

function EventCard({
  event,
  active,
  starred,
  compact = false,
  onSelect,
  onToggleStar,
}: {
  event: ReservationEvent;
  active: boolean;
  starred: boolean;
  compact?: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
}) {
  return (
    <article
      onClick={onSelect}
      className={`group cursor-pointer overflow-hidden rounded-[26px] bg-white/12 text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/16 ${
        active ? "ring-4 ring-[#f7d657]/18" : ""
      }`}
    >
      <div className={compact ? "flex gap-3 p-3" : "grid gap-4 p-3 sm:grid-cols-[190px_1fr] sm:p-4"}>
        <img
          src={event.image}
          alt=""
          className={
            compact
              ? "h-24 w-24 shrink-0 rounded-[21px] object-cover"
              : "h-40 w-full rounded-[23px] object-cover sm:h-full sm:min-h-[180px]"
          }
        />
        <div className="min-w-0 py-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-full bg-[#f7d657]/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4d2b23]">
                {event.status}
              </span>
              <h3 className={`${compact ? "text-lg" : "text-2xl"} mt-3 font-black leading-tight tracking-[-0.05em] text-white`}>
                {event.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/14 text-[#f7d657] backdrop-blur transition hover:bg-white/22"
              aria-label={starred ? "Unpin event" : "Pin event"}
            >
              <StarIcon filled={starred} />
            </button>
          </div>
          <p className={`${compact ? "line-clamp-2 text-sm" : "text-base"} font-semibold leading-relaxed text-white/78`}>
            {event.subtitle}
          </p>
          {!compact && <p className="mt-3 text-sm font-medium leading-relaxed text-white/62">{event.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {[`${event.day} ${event.date}`, event.time, event.capacity, event.price].map((pill) => (
              <span key={pill} className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-black text-white/88">
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ReservationPage() {
  const today = useMemo(() => new Date(), []);
  const [selectedEventId, setSelectedEventId] = useState(events[0].id);
  const [pinnedEventId, setPinnedEventId] = useState(events[0].id);
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [calendarMonth, setCalendarMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedTime, setSelectedTime] = useState(`${today.getHours()}`.padStart(2, "0") + ":00");
  const calendarInputRef = useRef<HTMLInputElement | null>(null);

  const dates = useMemo(() => getMonthDates(calendarMonth), [calendarMonth]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0],
    [selectedEventId]
  );

  const pinnedEvent = useMemo(
    () => events.find((event) => event.id === pinnedEventId) ?? null,
    [pinnedEventId]
  );

  const selectedDateLabel = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return `${dayLabels[date.getDay()]} ${day}`;
  }, [selectedDate]);

  const openCalendar = () => {
    const input = calendarInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  return (
    <main
      className="min-h-screen overflow-hidden bg-[#a9655e] text-white"
      style={{ fontFamily: "Raleway, var(--font-raleway), Arial, sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,215,89,0.18),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.11),transparent_30%),linear-gradient(180deg,#b56d65_0%,#9e5e57_46%,#8d514b_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-35 [background-image:linear-gradient(115deg,transparent_0%,transparent_54%,rgba(247,214,87,.48)_54.4%,transparent_55.2%),linear-gradient(127deg,transparent_0%,transparent_62%,rgba(247,214,87,.35)_62.4%,transparent_63%)]" />

      <section className="relative mx-auto min-h-screen w-full max-w-[1240px] px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <div className="mx-auto w-full max-w-[520px] lg:max-w-none">
          <AdminMobileHeader
            title="Reservation"
            homeHref="/reservation"
            profileHref="/reservation"
            className="border-white/12 bg-white/10 shadow-none backdrop-blur-xl lg:max-w-[520px]"
          />
        </div>

        <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mt-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f7d657]">PRO&apos;s Cafe</p>
            <h1 className="mt-1 text-[38px] font-black leading-none tracking-[-0.07em] text-white sm:text-[52px] lg:text-[68px]">
              Reservation
            </h1>
          </div>
          <button
            type="button"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#f7d657] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#4d2b23] transition hover:-translate-y-0.5 hover:bg-[#ffe46d] sm:w-auto lg:min-h-[56px] lg:px-7"
          >
            <PlusIcon />
            <span>Create Event</span>
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)] lg:items-start">
          <div className="grid gap-5 lg:sticky lg:top-6">
            <section className="rounded-[30px] bg-white/10 p-4 backdrop-blur-xl sm:p-5 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white lg:text-base">Select date</p>
                  <p className="mt-0.5 text-[11px] font-bold text-white/65">Full month · default today</p>
                </div>
                <button
                  type="button"
                  onClick={openCalendar}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f7d657] text-[#4d2b23] transition hover:bg-[#ffe46d]"
                  aria-label="Open calendar"
                >
                  <CalendarIcon />
                </button>
                <input
                  ref={calendarInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    const [year, month] = value.split("-").map(Number);
                    setSelectedDate(value);
                    setCalendarMonth(new Date(year, month - 1, 1));
                  }}
                  className="sr-only"
                  aria-label="Choose another date"
                />
              </div>

              <div className="mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2.5">
                {dates.map((date) => {
                  const active = selectedDate === date.key;
                  return (
                    <button
                      key={date.key}
                      type="button"
                      onClick={() => setSelectedDate(date.key)}
                      className={`min-w-[49px] snap-start rounded-2xl border px-2 py-2 text-center transition lg:min-w-[56px] lg:py-2.5 ${
                        active
                          ? "border-[#f7d657] bg-[#f7d657] text-[#4d2b23]"
                          : "border-white/12 bg-white/10 text-white"
                      }`}
                    >
                      <span className="block text-[9px] font-bold lg:text-[10px]">{date.day}</span>
                      <span className="mt-0.5 block text-[13px] font-black lg:text-[15px]">{date.num}</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-sm font-black text-white lg:text-base">Select time</p>
              <div className="mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-2.5">
                {times.map((time) => {
                  const active = selectedTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`min-w-[62px] snap-start rounded-2xl border px-3 py-2 text-xs font-black transition lg:min-w-[72px] lg:py-2.5 ${
                        active
                          ? "border-[#f7d657] bg-[#f7d657] text-[#4d2b23]"
                          : "border-white/12 bg-white/10 text-white"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </section>

            {pinnedEvent && (
              <section className="rounded-[30px] bg-white/12 p-4 backdrop-blur-xl sm:p-5 lg:p-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#f7d657]">
                  <StarIcon filled />
                  Pinned event
                </div>
                <EventCard
                  event={pinnedEvent}
                  active={selectedEventId === pinnedEvent.id}
                  starred
                  compact
                  onSelect={() => setSelectedEventId(pinnedEvent.id)}
                  onToggleStar={() => setPinnedEventId("")}
                />
              </section>
            )}
          </div>

          <section className="rounded-[32px] bg-white/10 p-4 backdrop-blur-xl sm:p-5 lg:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f7d657]">Event preview</p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.06em] text-white lg:text-4xl">Available events</h2>
              </div>
              <p className="text-sm font-bold text-white/70 sm:text-right">
                {selectedDateLabel} · {selectedTime}
              </p>
            </div>

            <div className="mb-5 overflow-hidden rounded-[30px] bg-white/12">
              <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                <img src={selectedEvent.image} alt="" className="h-64 w-full object-cover lg:h-full" />
                <div className="p-5 lg:p-7">
                  <span className="rounded-full bg-[#f7d657]/95 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#4d2b23]">
                    Selected event
                  </span>
                  <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-0.06em] text-white lg:text-4xl">
                    {selectedEvent.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-white/72 lg:text-base">
                    {selectedEvent.description}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {[`${selectedEvent.day} ${selectedEvent.date}`, selectedEvent.time, selectedEvent.capacity, selectedEvent.price].map((pill) => (
                      <span key={pill} className="rounded-2xl bg-white/12 px-3 py-2 text-center text-xs font-black text-white/88">
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  active={selectedEventId === event.id}
                  starred={pinnedEventId === event.id}
                  onSelect={() => {
                    setSelectedEventId(event.id);
                    setSelectedTime(event.time);
                  }}
                  onToggleStar={() => setPinnedEventId((current) => (current === event.id ? "" : event.id))}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
