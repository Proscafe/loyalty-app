"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Star,
  Ticket,
  Trash2,
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
  start.setDate(today.getDate() - 4);
  const end = new Date(today);
  end.setMonth(today.getMonth() + 2);
  const dates = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
    dates.push(formatDateButton(new Date(d)));
  return dates;
}

function buildTimes() {
  const items = [{ label: "Now", value: "now" }];
  const start = 10 * 60;
  const end = 26 * 60;
  for (let minutes = start; minutes <= end; minutes += 30) {
    const hour24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    items.push({
      label: `${String(hour24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
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

export default function ReservationPage() {
  const dates = useMemo(() => buildDateRange(), []);
  const times = useMemo(() => buildTimes(), []);
  const todayValue = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [selectedTime, setSelectedTime] = useState("");
  const [eventsOpen, setEventsOpen] = useState(true);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#a65d52] font-[Raleway,Arial,sans-serif] text-white">
      <style jsx global>{`
        .hide-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(255,217,82,0.22),transparent_30%),linear-gradient(145deg,#c7775c_0%,#a65a50_42%,#8f4b45_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-4 sm:px-8 lg:px-14 lg:py-8">
        <div className="mb-5 overflow-hidden rounded-[26px] border border-white/10 bg-white/10 backdrop-blur-md lg:mb-5">
          <AdminMobileHeader />
        </div>

        <section className="mb-5 flex items-end justify-between gap-4 lg:mb-6">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.34em] text-[#ffdd57]">
              PRO&apos;S CAFE
            </p>
            <h1 className="text-[30px] font-black leading-[0.95] tracking-[-0.04em] text-white">
              Reservation
            </h1>
          </div>
          <button className="rounded-2xl bg-[#ffdb57] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#2b211f] transition hover:scale-[1.02] lg:px-5 lg:py-3">
            Create Event
          </button>
        </section>

        <section className="mb-7 rounded-[26px] bg-[#b76d60]/70 p-4 backdrop-blur-md lg:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-black text-white">
              Select date &amp; time
            </h2>
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-[#9a5048]/70 px-4 py-3 text-[11px] font-black uppercase tracking-[0.08em] text-white">
                {selectedDateLabel}
              </span>
              <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-[#ffdb57] text-[#2b211f]">
                <CalendarDays size={18} />
                <input
                  className="sr-only"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="relative mb-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollByAmount(dateRef, "left")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffdb57] text-[#2b211f]"
            >
              <ChevronLeft size={20} />
            </button>
            <div
              ref={dateRef}
              className="hide-scrollbar flex flex-1 gap-3 overflow-x-auto scroll-smooth py-1"
            >
              {dates.map((date) => {
                const active = date.value === selectedDate;
                return (
                  <button
                    key={date.value}
                    type="button"
                    onClick={() => setSelectedDate(date.value)}
                    className={`min-w-[66px] rounded-2xl px-3 py-3 text-center transition ${active ? "bg-[#ffdb57] text-[#2b211f]" : "bg-[#9a5048]/70 text-white hover:bg-[#8e463f]/85"}`}
                  >
                    <span className="block text-[9px] font-black uppercase">
                      {date.weekday}
                    </span>
                    <span className="mt-1 block text-[16px] font-black leading-none">
                      {date.day}
                    </span>
                    <span className="mt-1 block text-[9px] font-black uppercase">
                      {date.month}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollByAmount(dateRef, "right")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffdb57] text-[#2b211f]"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => scrollByAmount(timeRef, "left")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffdb57] text-[#2b211f]"
            >
              <ChevronLeft size={20} />
            </button>
            <div
              ref={timeRef}
              className="hide-scrollbar flex flex-1 gap-3 overflow-x-auto scroll-smooth py-1"
            >
              {times.map((time) => {
                const active = time.value === selectedTime;
                return (
                  <button
                    key={time.value}
                    type="button"
                    onClick={() => setSelectedTime(time.value)}
                    className={`min-w-[78px] rounded-2xl px-4 py-3 text-[13px] font-black transition ${active ? "bg-[#ffdb57] text-[#2b211f]" : time.value === "now" && selectedTime === "" ? "border border-[#ffdb57] bg-transparent text-[#ffdb57]" : "bg-[#9a5048]/70 text-white hover:bg-[#8e463f]/85"}`}
                  >
                    {time.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollByAmount(timeRef, "right")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffdb57] text-[#2b211f]"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-[26px] bg-[#b76d60]/45 p-4 backdrop-blur-md lg:p-5">
          <button
            type="button"
            onClick={() => setEventsOpen((value) => !value)}
            className="mb-4 flex w-full items-center justify-between gap-4 text-left"
          >
            <h2 className="text-[22px] font-black tracking-[-0.04em] text-white">
              Events
            </h2>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffdb57] text-[#2b211f]">
              {eventsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>
          {eventsOpen ? (
            <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
              {upcomingEvents.map((event) => {
                const [eventDayName = "", eventDay = ""] =
                  event.dateLabel.split(" ");
                return (
                  <article
                    key={event.id}
                    className="flex min-w-[270px] max-w-[270px] gap-3 rounded-[24px] bg-[#9a5048]/82 p-3 shadow-none backdrop-blur-md sm:min-w-[300px] sm:max-w-[300px]"
                  >
                    <div
                      className={`grid h-[74px] w-[62px] shrink-0 place-items-center rounded-2xl text-center ${event.pinned ? "bg-[#ffdb57] text-[#2b211f]" : "bg-[#8e463f]/85 text-white"}`}
                    >
                      <div>
                        <span className="block text-[9px] font-black uppercase leading-none">
                          {eventDayName}
                        </span>
                        <span className="mt-1 block text-[18px] font-black leading-none">
                          {eventDay}
                        </span>
                        <span className="mt-1 block text-[9px] font-black uppercase leading-none">
                          JUN
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-[15px] font-black leading-tight text-white">
                          {event.title}
                        </h3>
                        <Star
                          size={15}
                          fill={event.pinned ? "#ffdb57" : "none"}
                          className="mt-0.5 shrink-0 text-[#ffdb57]"
                        />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-white/78">
                        {event.subtitle}
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-1 text-[9.5px] font-black text-white/95">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-[#ffdb57]" />
                          {event.timeLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={11} className="text-[#ffdb57]" />
                          {event.guests}
                        </span>
                        <span className="flex items-center gap-1">
                          <Ticket size={11} className="text-[#ffdb57]" />
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

        <section className="flex-1 rounded-[28px] bg-[#f7f1ed]/95 p-3 text-[#2b211f] shadow-2xl shadow-black/10 lg:p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#a65d52]">
                Reservation table
              </p>
              <h2 className="mt-1 text-[22px] font-black tracking-[-0.04em]">
                All reservations
              </h2>
            </div>
            <button className="rounded-2xl bg-[#ffdb57] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#2b211f]">
              Add reservation
            </button>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-[#e3d2cc] bg-white/80">
            <table className="min-w-[760px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#efe1dc] text-[10px] font-black uppercase tracking-[0.1em] text-[#9a5048]">
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Full Name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Guests</th>
                  <th className="px-3 py-3">Table</th>
                  <th className="px-3 py-3">Actions</th>
                  <th className="px-3 py-3 text-center">Confirm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadbd6]">
                {reservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="bg-white/50 transition hover:bg-[#fff8ec]"
                  >
                    <td className="px-3 py-2 text-[12px] font-black text-[#8c463f]">
                      {reservation.time}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-[13px] font-black leading-none text-[#2b211f]">
                        {reservation.fullName}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`tel:${reservation.phone.replace(/\s/g, "")}`}
                        className="text-[12px] font-extrabold leading-none text-[#2b211f]"
                      >
                        {reservation.phone}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-[12px] font-black">
                      {reservation.guests}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-black">
                      {reservation.table}
                    </td>
                    <td className="px-3 py-2">
                      <button className="inline-flex items-center gap-1 rounded-full bg-[#ffe3df] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#c9453f]">
                        <Trash2 size={12} /> Delete
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        className={`inline-flex min-w-[82px] items-center justify-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] ${reservation.status === "Confirmed" ? "bg-[#ffdb57] text-[#2b211f]" : reservation.status === "Late" ? "bg-[#ffe3df] text-[#b73a34]" : reservation.status === "No Show" ? "bg-[#e5d8d2] text-[#6d3b36]" : "bg-[#f2e5df] text-[#8c463f]"}`}
                      >
                        {reservation.status === "Pending"
                          ? "Confirm"
                          : reservation.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
