"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Phone,
  Table2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import AdminMobileHeader from "@/components/AdminMobileHeader";

type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  dayLabel: string;
  dateLabel: string;
  timeLabel: string;
  isoDate: string;
  guests: string;
  tables: string;
  price: string;
  pinned?: boolean;
};

type EventReservation = {
  id: string;
  fullName: string;
  phone: string;
  guests: number;
  table: string;
  status: "Confirmed" | "Pending" | "Arrived" | "No Show";
  bookedAt: string;
};

const events: EventItem[] = [
  {
    id: "rayfoun-live-night",
    title: "Rayfoun Live Night",
    subtitle: "Dinner, drinks, music, and mountain views",
    description:
      "Reserve a table for a relaxed PRO's Rayfoun evening with food, drinks, music, and mountain views.",
    dayLabel: "Tue",
    dateLabel: "13 Jun 2026",
    timeLabel: "17:00",
    isoDate: "2026-06-13",
    guests: "42 guests",
    tables: "5/20 tables",
    price: "Free entry",
    pinned: true,
  },
  {
    id: "sunset-dinner",
    title: "Sunset Dinner",
    subtitle: "Golden hour terrace reservations",
    description:
      "A cozy dinner setup for friends, families, and groups on the Rayfoun terrace.",
    dayLabel: "Mon",
    dateLabel: "29 Jun 2026",
    timeLabel: "20:30",
    isoDate: "2026-06-29",
    guests: "18 guests",
    tables: "8/20 tables",
    price: "Reservation only",
  },
  {
    id: "football-night",
    title: "Football Night",
    subtitle: "Big screen match night",
    description:
      "Book your table for game night with food, drinks, and PRO's match atmosphere.",
    dayLabel: "Fri",
    dateLabel: "03 Jul 2026",
    timeLabel: "22:00",
    isoDate: "2026-07-03",
    guests: "24 guests",
    tables: "11/20 tables",
    price: "Free entry",
  },
];

const guestNames = [
  "Toufic Tandouri",
  "Maya Karam",
  "Karim Saab",
  "Rony Haddad",
  "Nour Hajj",
  "Wissam Mantoufeh",
  "Abed Usta",
  "Anthony Saliba",
  "Hussein Yassine",
  "Alain Khoury",
  "Mireille Haddad",
  "Georges Nader",
  "Lara Mansour",
  "Elias Aoun",
  "Nadine Farah",
  "Jad Bou Saab",
  "Rita Chemaly",
  "Omar Khalil",
  "Samer Daher",
  "Tania Habib",
  "Fadi Nehme",
  "Dana Younes",
  "Marc Abi Rached",
  "Elie Hajj",
  "Sarah Ghanem",
  "Charbel Azar",
  "Ralph Saliba",
  "Paula Khoury",
  "Walid Rahme",
  "Mira Sfeir",
];

const tables = [
  "Indoor 12",
  "Terrace 5",
  "Lounge 3",
  "Terrace 2",
  "Indoor 9",
  "VIP Sofa",
  "Big Screen 1",
  "Indoor 4",
  "Garden 7",
  "Bar 2",
  "Terrace 9",
  "Indoor 15",
  "Lounge 8",
  "Garden 3",
  "VIP 2",
];

function buildMockReservations(eventId: string): EventReservation[] {
  const offset = eventId === "football-night" ? 2 : eventId === "sunset-dinner" ? 1 : 0;

  return guestNames.map((fullName, index) => {
    const statusPattern: EventReservation["status"][] = [
      "Arrived",
      "Confirmed",
      "Confirmed",
      "Pending",
      "Arrived",
      "No Show",
      "Confirmed",
      "Arrived",
      "Pending",
      "Confirmed",
    ];

    return {
      id: `mock-${eventId}-${index + 1}`,
      fullName,
      phone: `0${3 + ((index + offset) % 7)} ${String(720000 + index * 2713 + offset * 407).slice(0, 3)} ${String(210 + index * 17).padStart(3, "0")}`,
      guests: ((index + offset) % 8) + 1,
      table: tables[(index + offset) % tables.length],
      status: statusPattern[(index + offset) % statusPattern.length],
      bookedAt: `${String(10 + ((index + offset) % 10)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "45"}`,
    };
  });
}

function getEventDateTime(event: EventItem) {
  return new Date(`${event.isoDate}T${event.timeLabel}:00`);
}

function getTimeLeft(event: EventItem) {
  const now = new Date();
  const eventDate = getEventDateTime(event);
  const diffMs = eventDate.getTime() - now.getTime();

  if (diffMs <= 0) return "Started";

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} day${days === 1 ? "" : "s"}, ${hours} hr${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hr${hours === 1 ? "" : "s"}, ${minutes} min`;
  return `${minutes} min`;
}

function getStatusClasses(status: EventReservation["status"]) {
  if (status === "Arrived") return "bg-[#eaf7e2] text-[#315d2c]";
  if (status === "No Show") return "bg-[#ffe3df] text-[#9a3f38]";
  if (status === "Pending") return "bg-[#ffdb57] text-[#2b211f]";
  return "bg-[#fff7f1] text-[#6b5651]";
}

export default function EventReservationDetailsPage() {
  const router = useRouter();
  const params = useParams<{ eventId: string }>();
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const reservations = useMemo(() => buildMockReservations(event.id), [event.id]);

  const totals = useMemo(() => {
    const guests = reservations.reduce((sum, reservation) => sum + reservation.guests, 0);
    const tableCount = new Set(reservations.map((reservation) => reservation.table)).size;
    const arrived = reservations.filter((reservation) => reservation.status === "Arrived").length;
    const noShows = reservations.filter((reservation) => reservation.status === "No Show").length;
    return { guests, tableCount, arrived, noShows };
  }, [reservations]);

  const guestSizeBreakdown = useMemo(() => {
    const groups = reservations.reduce<Record<number, number>>((acc, reservation) => {
      acc[reservation.guests] = (acc[reservation.guests] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(groups)
      .map(([guestCount, tableCount]) => ({
        guestCount: Number(guestCount),
        tableCount,
      }))
      .sort((a, b) => b.tableCount - a.tableCount || a.guestCount - b.guestCount);
  }, [reservations]);

  const timeLeft = useMemo(() => getTimeLeft(event), [event]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf5ef] text-[#22110f]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,217,82,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(166,93,82,0.15),transparent_26%),linear-gradient(135deg,#fff8f1_0%,#fbf2eb_46%,#f5e4dc_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-3 sm:px-8 lg:px-14 lg:py-5">
        <div className="mb-4 overflow-hidden rounded-[30px] border border-white/25 bg-gradient-to-r from-[#893b35] via-[#a65d52] to-[#c0735e] shadow-xl shadow-[#5f2b26]/15 lg:mb-6">
          <AdminMobileHeader />
        </div>

        <section className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/reservation")}
              className="mb-4 inline-flex items-center gap-2 rounded-[15px] border border-[#ead6ce] bg-white/80 px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.1em] text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <h1 className="text-[36px] font-black leading-[0.95] tracking-[-0.055em] text-[#351614]">
              {event.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-black uppercase tracking-[0.08em] text-[#7a605a]">
              <span>{event.title}</span>
              <span className="text-[#c5aaa1]">-</span>
              <span>{event.dayLabel}</span>
              <span className="text-[#c5aaa1]">-</span>
              <span>{event.dateLabel}</span>
              <span className="text-[#c5aaa1]">-</span>
              <span>{event.timeLabel}</span>
              <span className="text-[#c5aaa1]">-</span>
              <span className="rounded-full bg-[#ffdb57] px-3 py-1 text-[#2b211f]">
                Time left: {timeLeft}
              </span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <article className="rounded-[24px] border border-[#ead6ce] bg-white/88 p-5 shadow-lg shadow-[#9a5048]/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Table Count</p>
              <Table2 size={18} className="text-[#8f3f38]" />
            </div>
            <p className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#2b211f]">{totals.tableCount}</p>
          </article>

          <article className="rounded-[24px] border border-[#ead6ce] bg-white/88 p-5 shadow-lg shadow-[#9a5048]/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Guests</p>
              <Users size={18} className="text-[#8f3f38]" fill="currentColor" />
            </div>
            <p className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#2b211f]">{totals.guests}</p>
          </article>

          <article className="rounded-[24px] border border-[#ead6ce] bg-white/88 p-5 shadow-lg shadow-[#9a5048]/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Arrived</p>
              <UserRound size={18} className="text-[#8f3f38]" />
            </div>
            <p className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#2b211f]">{totals.arrived}</p>
          </article>

          <article className="rounded-[24px] border border-[#ead6ce] bg-white/88 p-5 shadow-lg shadow-[#9a5048]/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">No Show</p>
              <Trash2 size={18} className="text-[#8f3f38]" />
            </div>
            <p className="mt-3 text-[34px] font-black tracking-[-0.06em] text-[#2b211f]">{totals.noShows}</p>
          </article>
        </section>

        <section className="mb-10 overflow-hidden rounded-[26px] border border-[#ead6ce] bg-white/88 text-[#2b211f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md">
          <div className="border-b border-[#eadbd6] px-5 py-5 lg:px-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              {guestSizeBreakdown.map((item) => (
                <div
                  key={item.guestCount}
                  className="rounded-[18px] border border-[#ead6ce] bg-white/75 px-4 py-3 shadow-sm"
                >
                  <p className="text-[12px] font-black text-[#5a302b]">
                    {item.guestCount} guest{item.guestCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-[18px] font-black tracking-[-0.04em] text-[#2b211f]">
                    {item.tableCount} table{item.tableCount === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f5ebe5] text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                  <th className="px-5 py-3 lg:px-8">Full name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3 text-center">Guests</th>
                  <th className="px-5 py-3">Table</th>
                  <th className="px-5 py-3">Booked at</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadbd6]">
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="bg-white/50 transition hover:bg-[#fff8ec]">
                    <td className="px-5 py-4 lg:px-8">
                      <span className="inline-flex items-center gap-2 text-[13px] font-black">
                        <UserRound size={15} className="text-[#8f3f38]" />
                        {reservation.fullName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-black">
                      <span className="inline-flex items-center gap-2">
                        <Phone size={15} className="text-[#8f3f38]" />
                        {reservation.phone}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center text-[13px] font-black">{reservation.guests}</td>
                    <td className="px-5 py-4 text-[13px] font-black">{reservation.table}</td>
                    <td className="px-5 py-4 text-[13px] font-black">
                      <span className="inline-flex items-center gap-2">
                        <Clock size={15} className="text-[#8f3f38]" />
                        {reservation.bookedAt}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex min-w-[92px] items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-black ${getStatusClasses(reservation.status)}`}>
                        {reservation.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#ffe3df] text-[#c9453f] transition hover:scale-105"
                        aria-label={`Delete reservation for ${reservation.fullName}`}
                      >
                        <Trash2 size={14} />
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
