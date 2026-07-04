"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminMobileHeader from "@/components/AdminMobileHeader";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Share2,
  Star,
  Table2,
  Trash2,
  Users,
  X,
} from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  dateLabel: string;
  dateValue: string;
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
  status: "Confirmed" | "Arrived" | "Late" | "No Show" | "Pending" | "Cancelled";
  confirmedAt?: string;
  arrivedAt?: string;
};

const upcomingEvents: EventItem[] = [
  {
    id: "rayfoun-live-night",
    title: "Rayfoun Live Night",
    subtitle: "Dinner, drinks, music, and mountain views",
    description:
      "Reserve a table for a relaxed PRO's Rayfoun evening with food, drinks, music, and mountain views.",
    dateLabel: "Tue 13",
    dateValue: "2026-06-13",
    timeLabel: "17:00",
    seats: "42 seats left",
    price: "Free entry",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    guests: "42 guests",
    tables: "5/20 tables",
  },
  {
    id: "sunset-dinner",
    title: "Sunset Dinner",
    subtitle: "Golden hour terrace reservations",
    description:
      "A cozy dinner setup for friends, families, and groups on the Rayfoun terrace.",
    dateLabel: "Mon 29",
    dateValue: "2026-06-29",
    timeLabel: "20:30",
    seats: "18 seats left",
    price: "Reservation only",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    guests: "18 guests",
    tables: "8/20 tables",
    pinned: true,
  },
  {
    id: "football-night",
    title: "Football Night",
    subtitle: "Big screen match night",
    description:
      "Book your table for game night with food, drinks, and PRO's match atmosphere.",
    dateLabel: "Fri 03",
    dateValue: "2026-07-03",
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

function formatDateValueLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodayDateValue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return formatDateValueLocal(today);
}

function getTimeMinutes(value: string) {
  const trimmed = value.trim();
  const amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  const [hours = "0", minutes = "0"] = trimmed.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isPastDateValue(dateValue: string, todayValue: string) {
  return dateValue < todayValue;
}

function isPastDateTime(dateValue: string, timeValue: string, todayValue: string) {
  if (dateValue < todayValue) return true;
  if (dateValue > todayValue) return false;
  return getTimeMinutes(timeValue) <= getNowMinutes();
}

function formatDateButton(date: Date) {
  return {
    weekday: date
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase(),
    day: date.getDate().toString(),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    value: formatDateValueLocal(date),
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

  return formatTimeLabel(hour % 24, minutes);
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
      value: formatTimeLabel(hour24, mins),
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
  const cells: Array<{
    key: string;
    day: number | null;
    total: number;
    dateValue?: string;
  }> = [];

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

function getEventDateValue(event: EventItem, fallbackDate: string) {
  if (event.dateValue) return event.dateValue;

  const fallback = new Date(`${fallbackDate}T00:00:00`);
  const year = fallback.getFullYear();
  const eventDay = Number(event.dateLabel.split(" ")[1]) || fallback.getDate();

  return `${year}-06-${String(eventDay).padStart(2, "0")}`;
}

function getEventMonthLabel(event: EventItem, fallbackDate: string) {
  const dateValue = getEventDateValue(event, fallbackDate);
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
  }).toUpperCase();
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "reservations";
}


function csvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildReservationsCsvBlob(rows: Reservation[]) {
  const header = ["Time", "Full Name", "Phone", "Guests", "Table", "Confirmed", "Status"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((reservation) =>
      [
        reservation.time,
        reservation.fullName,
        reservation.phone,
        reservation.guests,
        reservation.table,
        reservation.confirmedAt || "",
        reservation.status,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new Blob([`\ufeff${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
}

function buildReservationsExcelBlob(title: string, subtitle: string, rows: Reservation[]) {
  const tableRows = rows
    .map(
      (reservation) => `
        <tr>
          <td>${escapeHtml(reservation.time)}</td>
          <td>${escapeHtml(reservation.fullName)}</td>
          <td>${escapeHtml(reservation.phone)}</td>
          <td>${escapeHtml(reservation.guests)}</td>
          <td>${escapeHtml(reservation.table)}</td>
          <td>${escapeHtml(reservation.confirmedAt || "")}</td>
          <td>${escapeHtml(reservation.status)}</td>
        </tr>`,
    )
    .join("");

  const workbook = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 0.35in; }
          body { font-family: Arial, sans-serif; color: #22110f; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          p { margin: 0 0 12px; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #f5ebe5; color: #8f3f38; text-align: left; }
          th, td { border: 1px solid #8f3f38; padding: 7px; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Guests</th>
              <th>Table</th>
              <th>Confirmed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>`;

  return new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
}

export default function ReservationPage() {
  const router = useRouter();
  const dates = useMemo(() => buildDateRange(), []);
  const times = useMemo(() => buildTimes(), []);
  const todayValue = getTodayDateValue();
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [selectedTime, setSelectedTime] = useState(() => getCurrentTimeSlot());
  const [activeSection, setActiveSection] = useState<"bookings" | "events">(
    "bookings",
  );
  const [reservationView, setReservationView] = useState<"table" | "month">(
    "table",
  );
  const [eventView, setEventView] = useState<"list" | "month">("list");
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [shareFallbackOpen, setShareFallbackOpen] = useState(false);
  const [eventCreationModalOpen, setEventCreationModalOpen] = useState(false);
  const [createEventFavorite, setCreateEventFavorite] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [bookingRows, setBookingRows] = useState<Reservation[]>(reservations);
  const [selectedBooking, setSelectedBooking] = useState<Reservation | null>(null);
  const [statusBooking, setStatusBooking] = useState<Reservation | null>(null);
  const dateRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const selectedDateButton =
      dateRef.current?.querySelector<HTMLButtonElement>(
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
    () =>
      reservations.reduce((sum, reservation) => sum + reservation.guests, 0),
    [],
  );
  const totalTables = useMemo(
    () => new Set(reservations.map((reservation) => reservation.table)).size,
    [],
  );

  function updateBookingRow(id: string, updates: Partial<Reservation>) {
    setBookingRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  function getConfirmStamp() {
    const now = new Date();
    return `${now.getDate()}/${now.getMonth() + 1} - ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function getNowTimeLabel() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function getStatusLabel(reservation: Reservation) {
    if (reservation.status === "Arrived") return `Arrived - ${reservation.arrivedAt || getNowTimeLabel()}`;
    return reservation.status;
  }

  function setBookingStatus(reservation: Reservation, status: Reservation["status"]) {
    const updates: Partial<Reservation> = { status };
    if (status === "Arrived") {
      updates.arrivedAt = getNowTimeLabel();
    }
    updateBookingRow(reservation.id, updates);
    setStatusBooking((current) => (current?.id === reservation.id ? { ...reservation, ...updates } : current));
    setSelectedBooking((current) => (current?.id === reservation.id ? { ...reservation, ...updates } : current));
  }

  function getBookingStatusClass(status: Reservation["status"]) {
    if (status === "Arrived" || status === "Confirmed") return "border-[#b9ead1] bg-[#d9f8e6] text-[#23663f]";
    if (status === "Late") return "border-[#ffd6a0] bg-[#fff0d8] text-[#9a5018]";
    if (status === "No Show") return "border-[#ffbdb6] bg-[#ffe1dc] text-[#9b4439]";
    if (status === "Cancelled") return "border-[#d8d0ca] bg-[#eee9e4] text-[#6d625f]";
    return "border-[#f1c847] bg-[#fff1a8] text-[#4a3410]";
  }
  const totalEventGuests = useMemo(
    () =>
      upcomingEvents.reduce((sum, event) => {
        const numericGuests = Number(event.guests.replace(/\D/g, "")) || 0;
        return sum + numericGuests;
      }, 0),
    [],
  );
  const sortedEvents = useMemo(
    () =>
      [...upcomingEvents].sort((firstEvent, secondEvent) => {
        if (firstEvent.pinned && !secondEvent.pinned) return -1;
        if (!firstEvent.pinned && secondEvent.pinned) return 1;

        const firstDateTime = `${getEventDateValue(firstEvent, selectedDate)}T${firstEvent.timeLabel}`;
        const secondDateTime = `${getEventDateValue(secondEvent, selectedDate)}T${secondEvent.timeLabel}`;
        return firstDateTime.localeCompare(secondDateTime);
      }),
    [selectedDate],
  );
  const activeEvents = useMemo(
    () =>
      sortedEvents
        .filter((event) => {
          const eventDateValue = getEventDateValue(event, selectedDate);
          return !isPastDateTime(eventDateValue, event.timeLabel, todayValue);
        })
        .sort((firstEvent, secondEvent) => {
          if (firstEvent.pinned && !secondEvent.pinned) return -1;
          if (!firstEvent.pinned && secondEvent.pinned) return 1;

          const firstDateTime = `${getEventDateValue(firstEvent, selectedDate)}T${firstEvent.timeLabel}`;
          const secondDateTime = `${getEventDateValue(secondEvent, selectedDate)}T${secondEvent.timeLabel}`;
          return firstDateTime.localeCompare(secondDateTime);
        }),
    [sortedEvents, selectedDate, todayValue],
  );
  const hasEvents = upcomingEvents.length > 0;
  const hasActiveEvents = activeEvents.length > 0;

  useEffect(() => {
    if (selectedDate < todayValue) {
      setSelectedDate(todayValue);
    }
  }, [selectedDate, todayValue]);

  useEffect(() => {
    if (!hasEvents && activeSection === "events") {
      setActiveSection("bookings");
    }
  }, [activeSection, hasEvents]);

  function getSelectedDateRows() {
    return bookingRows;
  }

  function getSelectedDateExcelFile() {
    const label = selectedDateLabel.replace(/\s+/g, " ");
    const blob = buildReservationsExcelBlob(
      `Reservations - ${label}`,
      `${getSelectedDateRows().length} reservations for ${label}`,
      getSelectedDateRows(),
    );
    return new File([blob], `${safeFileName(`reservations-${label}`)}.xls`, {
      type: "application/vnd.ms-excel",
    });
  }

  function getSelectedDateCsvFile() {
    const label = selectedDateLabel.replace(/\s+/g, " ");
    const blob = buildReservationsCsvBlob(getSelectedDateRows());
    return new File([blob], `${safeFileName(`reservations-${label}`)}.csv`, {
      type: "text/csv",
    });
  }

  function downloadSelectedDateExcel() {
    const file = getSelectedDateExcelFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadSelectedDateCsv() {
    const file = getSelectedDateCsvFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function shareSelectedDateCsv() {
    const file = getSelectedDateCsvFile();
    const shareData: ShareData & { files?: File[] } = {
      title: `Reservations - ${selectedDateLabel}`,
      text: `Reservation CSV for ${selectedDateLabel}`,
      files: [file],
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const canShareFiles = !navigator.canShare || navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share(shareData);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    downloadSelectedDateCsv();
  }

  function openSharePopup() {
    setShareFallbackOpen(true);
  }

  function openEventDetails(event: EventItem) {
    router.push(`/reservation/events/${event.id}`);
  }

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
        <div className="mb-4 bg-transparent lg:mb-6">
          <AdminMobileHeader />
        </div>

        <section className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-5">
          <div>
            <h1 className="text-[30px] font-black leading-[0.95] tracking-[-0.055em] text-[#351614] sm:text-[36px] lg:text-[42px]">
              Reservation
            </h1>
            <p className="mt-2 max-w-[560px] text-[14px] font-medium leading-relaxed text-[#6b5651] sm:text-[15px]">
              Manage reservations, events, and table bookings.
            </p>

            <div className="mt-4 inline-flex rounded-[18px] border border-[#ead6ce] bg-white/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveSection("bookings")}
                className={`rounded-[14px] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] transition ${activeSection === "bookings" ? "bg-[#ffdb57] text-[#2b211f] shadow-md shadow-[#d6a83f]/20" : "text-[#6b5651] hover:bg-white"}`}
              >
                Reservations
              </button>
              {hasEvents ? (
                <button
                  type="button"
                  onClick={() => setActiveSection("events")}
                  className={`rounded-[14px] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] transition ${activeSection === "events" ? "bg-[#ffdb57] text-[#2b211f] shadow-md shadow-[#d6a83f]/20" : "text-[#6b5651] hover:bg-white"}`}
                >
                  Events
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openSharePopup}
              className="grid h-12 w-12 place-items-center rounded-[16px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
              aria-label="Share reservations"
            >
              <Share2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeSection === "events") {
                  setCreateEventFavorite(false);
                  setEventCreationModalOpen(true);
                  return;
                }

                setSelectedEvent(null);
                setReservationModalOpen(true);
              }}
              className="inline-flex w-fit items-center rounded-[18px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02] lg:px-6"
            >
              {activeSection === "events" ? "Create Event" : "Add Reservation"}
            </button>
          </div>
        </section>

        {hasActiveEvents ? (
        <section className="mb-5">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
            {activeEvents.slice(0, 3).map((event, index) => {
              const [eventDayName = "", eventDay = ""] =
                event.dateLabel.split(" ");
              const cardStyles = [
                "from-[#9a3f38] via-[#b96955] to-[#c27b60]",
                "from-[#61412e] via-[#a66a3e] to-[#d09a54]",
                "from-[#314f47] via-[#56786a] to-[#8ba486]",
              ];
              const eventDateValue = getEventDateValue(event, selectedDate);
              const eventInPast = isPastDateTime(eventDateValue, event.timeLabel, todayValue);

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    if (activeSection === "events") {
                      router.push(`/reservation/events/${event.id}`);
                      return;
                    }

                    setSelectedEvent(event);
                    setSelectedDate(getEventDateValue(event, selectedDate));
                    setSelectedTime(event.timeLabel);
                    setReservationModalOpen(true);
                  }}
                  className="group relative flex min-h-[134px] min-w-0 cursor-pointer flex-col overflow-hidden rounded-[22px] border border-[#ead6ce] bg-white text-left text-[#2b211f] shadow-lg shadow-[#9a5048]/12 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div className="flex items-center gap-3 bg-[#ffdb57] px-5 py-3 text-[#2b211f]">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-[12px] font-black uppercase leading-none">
                        {eventDayName}
                      </span>
                      <span className="text-[25px] font-black leading-none tracking-[-0.06em]">
                        {eventDay}
                      </span>
                      <span className="text-[12px] font-black uppercase leading-none">
                        {getEventMonthLabel(event, selectedDate)}
                      </span>
                    </div>
                    <span className="h-6 w-px bg-[#d6a83f]/50" />
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-black leading-none">
                      <Clock3 size={15} />
                      {event.timeLabel}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                    <h3 className="line-clamp-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-[#2b211f]">
                      {event.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug text-[#7a605a]">
                      {event.subtitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 border-t border-[#eadbd6] px-5 py-3 text-[12px] font-black text-[#2b211f]">
                    <span className="flex items-center gap-2 leading-tight">
                      <Users
                        size={17}
                        className="shrink-0 text-[#ffbf21]"
                        fill="currentColor"
                      />
                      <span className="min-w-0 truncate">
                        {event.guests.replace(/\s*guests/i, "")}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 border-l border-[#eadbd6] pl-4 leading-tight">
                      <Table2 size={17} className="shrink-0 text-[#ffbf21]" />
                      <span className="min-w-0">
                        {event.tables.replace(/\s*tables/i, "")}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
        ) : null}
        {activeSection === "bookings" ? (
        <>
        <section className="mb-5 rounded-[24px] border border-[#ead6ce] bg-white/86 p-4 text-[#22110f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md lg:p-5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[21px] font-black tracking-[-0.035em] text-[#2b211f]">
                Select date &amp; time
              </h2>
              <p className="mt-1 text-[12px] font-bold text-[#8a746f]">
                To complete your reservation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-2xl border border-[#e6cec5] bg-[#fff7f1] px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-[#5a302b]">
                {selectedDateLabel}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (dateInputRef.current?.showPicker) {
                    dateInputRef.current.showPicker();
                    return;
                  }
                  dateInputRef.current?.click();
                }}
                className="grid h-11 w-11 place-items-center rounded-[15px] border border-[#e6cec5] bg-white/85 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
                aria-label="Choose date from calendar"
              >
                <CalendarDays size={18} />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                min={todayValue}
                onChange={(event) => {
                  if (!event.target.value || event.target.value < todayValue) return;
                  setSelectedDate(event.target.value);
                }}
                className="sr-only"
                aria-label="Reservation date"
              />
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
                const disabledDate = isPastDateValue(date.value, todayValue);
                return (
                  <button
                    key={date.value}
                    type="button"
                    data-date-value={date.value}
                    disabled={disabledDate}
                    onClick={() => {
                      if (disabledDate) return;
                      setSelectedDate(date.value);
                    }}
                    className={`min-w-[82px] rounded-[18px] border px-3 py-3 text-center transition ${disabledDate ? "cursor-not-allowed border-[#ead6ce] bg-[#f0e5df]/70 text-[#b5a4a0] opacity-55" : active ? "border-[#ffdb57] bg-[#ffdb57] text-[#2b211f] shadow-lg shadow-[#e6bc40]/25" : "border-[#e7cfc7] bg-white/75 text-[#2b211f] hover:border-[#ffdb57] hover:bg-[#fff8dd]"}`}
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
              {times
                .filter((time) => !isPastDateTime(selectedDate, time.value, todayValue))
                .map((time) => {
                const active = time.value === selectedTime;
                return (
                  <button
                    key={time.value}
                    type="button"
                    onClick={() => {
                      setSelectedEvent(null);
                      setSelectedTime(time.value);
                      setReservationModalOpen(true);
                    }}
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

        </>
        ) : null}

        {hasEvents && activeSection === "events" ? (
          <section className="mb-10 overflow-hidden rounded-[26px] border border-[#ead6ce] bg-white/88 text-[#2b211f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md">
            <div className="grid gap-4 border-b border-[#eadbd6] px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center lg:px-8">
              {eventView === "month" ? (
                <div className="inline-flex items-center justify-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate((value) => moveMonth(value, "previous"))
                    }
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
                    onClick={() =>
                      setSelectedDate((value) => moveMonth(value, "next"))
                    }
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
                    aria-label="Next month"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-4">
                  <h2 className="text-[21px] font-black tracking-[-0.05em]">
                    Events
                  </h2>
                  <p className="text-[12px] font-black uppercase tracking-[0.1em] text-[#8a746f]">
                    {upcomingEvents.length} events · {totalEventGuests} guests
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
                <div className="inline-flex rounded-[16px] border border-[#ead6ce] bg-[#fff7f1] p-1">
                  <button
                    type="button"
                    onClick={() => setEventView("list")}
                    className={`rounded-[12px] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${eventView === "list" ? "bg-[#ffdb57] text-[#2b211f]" : "text-[#6b5651] hover:bg-white"}`}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventView("month")}
                    className={`rounded-[12px] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition ${eventView === "month" ? "bg-[#ffdb57] text-[#2b211f]" : "text-[#6b5651] hover:bg-white"}`}
                  >
                    Month
                  </button>
                </div>
              </div>
            </div>


            {eventView === "list" ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-[760px] w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#f5ebe5] text-[9px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">
                        <th className="px-5 py-3 lg:px-8">Event</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Time</th>
                        <th className="px-5 py-3">Guests</th>
                        <th className="px-5 py-3">Tables</th>
                        <th className="px-5 py-3 text-center">Favorite</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eadbd6]">
                      {sortedEvents.map((event) => {
                        const eventDateValue = getEventDateValue(event, selectedDate);
                        const eventInPast = isPastDateTime(eventDateValue, event.timeLabel, todayValue);

                        return (
                        <tr
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openEventDetails(event)}
                          onKeyDown={(keyboardEvent) => {
                            if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                              keyboardEvent.preventDefault();
                              openEventDetails(event);
                            }
                          }}
                          className="cursor-pointer bg-white/50 transition hover:bg-[#fff8ec] focus:outline-none focus:ring-2 focus:ring-[#ffdb57]"
                        >
                          <td className="px-5 py-4 lg:px-8">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-black text-[#2b211f]">
                                {event.title}
                              </p>
                              <p className="mt-1 max-w-[210px] truncate text-[12px] font-semibold text-[#7a605a]">
                                {event.subtitle}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[13px] font-black text-[#2b211f]">
                            {event.dateLabel} {getEventMonthLabel(event, selectedDate)}
                          </td>
                          <td className="px-5 py-4 text-[13px] font-black text-[#2b211f]">
                            {event.timeLabel}
                          </td>
                          <td className="px-5 py-4 text-[13px] font-black text-[#2b211f]">
                            {event.guests.replace(/\s*guests/i, "")}
                          </td>
                          <td className="px-5 py-4 text-[13px] font-black text-[#2b211f]">
                            {event.tables.replace(/\s*tables/i, "")}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${event.pinned ? "bg-[#ffefad] text-[#a67800]" : "bg-[#fff7f1] text-[#b79d95]"}`}>
                              <Star size={16} fill={event.pinned ? "currentColor" : "none"} />
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-[#eadbd6] px-5 py-5 text-[14px] font-medium text-[#6b5651] sm:flex-row sm:items-center sm:justify-between lg:px-8">
                  <p>Showing 1 to {upcomingEvents.length} of {upcomingEvents.length} events</p>
                  <div className="flex items-center gap-2">
                    <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white">
                      <ChevronLeft size={18} />
                    </button>
                    <button className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffdb57] font-black text-[#2b211f]">
                      1
                    </button>
                    <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#ead6ce] bg-white">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-5 lg:p-8">
                <div className="grid grid-cols-7 overflow-hidden rounded-[24px] border border-[#eadbd6] bg-white/70">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="border-b border-[#eadbd6] bg-[#f5ebe5] px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]"
                      >
                        {day}
                      </div>
                    ),
                  )}

                  {monthDays.map((cell) => {
                    const active =
                      cell.day && Number(selectedDate.slice(-2)) === cell.day;
                    const isToday = cell.dateValue === todayValue;
                    const eventTotal = cell.dateValue
                      ? upcomingEvents.filter(
                          (event) => getEventDateValue(event, selectedDate) === cell.dateValue,
                        ).length
                      : 0;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!cell.day}
                        onClick={() => {
                          if (!cell.dateValue) return;
                          setSelectedDate(cell.dateValue);
                        }}
                        className={`relative min-h-[112px] border-b border-r border-[#eadbd6] p-3 transition ${cell.day ? "cursor-pointer bg-white/55 hover:bg-[#fff8dd]" : "cursor-default bg-[#fbf5ef]/70"} ${active ? "bg-[#fff4c8]" : ""} ${isToday ? "ring-1 ring-inset ring-[#9b4439]" : ""}`}
                      >
                        {cell.day ? (
                          <>
                            <span
                              className={`absolute left-3 top-3 inline-flex min-w-[34px] items-center justify-center rounded-full px-2 py-1 text-[15px] font-black ${isToday ? "bg-[#9b4439] text-white" : "text-[#2b211f]"}`}
                            >
                              {cell.day}
                            </span>
                            <span
                              className={`mx-auto mt-7 grid h-14 w-14 place-items-center rounded-full text-[24px] font-black ${isToday ? "bg-[#9b4439] text-white" : eventTotal > 0 ? "bg-[#ffdb57] text-[#2b211f]" : "bg-[#f0e5df] text-[#8a746f]"}`}
                              aria-label={`${eventTotal} events`}
                            >
                              {eventTotal}
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

        {activeSection === "bookings" ? (
          <section className="mb-10 overflow-hidden rounded-[26px] border border-[#ead6ce] bg-white/88 text-[#2b211f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md">
            <div className="grid gap-4 border-b border-[#eadbd6] px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center lg:px-8">
              {reservationView === "month" ? (
                <div className="inline-flex items-center justify-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDate((value) => moveMonth(value, "previous"))
                    }
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
                    onClick={() =>
                      setSelectedDate((value) => moveMonth(value, "next"))
                    }
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#2b211f] shadow-sm transition hover:bg-[#ffdb57]"
                    aria-label="Next month"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline gap-4">
                  <h2 className="text-[21px] font-black tracking-[-0.05em]">
                    Reservations
                  </h2>
                  <p className="text-[12px] font-black uppercase tracking-[0.1em] text-[#8a746f]">
                    {totalGuests} guests · {totalTables} tables
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
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
                    Month
                  </button>
                </div>
              </div>
            </div>

            {reservationView === "table" ? (
              <>
                <div className="max-h-[460px] overflow-auto">
                  <table className="min-w-[600px] w-full table-fixed border-collapse text-left sm:min-w-[720px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#f5ebe5] text-[9px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">
                        <th className="w-[48px] px-1 py-2 sm:w-[58px] sm:px-2 sm:py-2.5">Time</th>
                        <th className="w-[98px] px-1 py-2 sm:w-[118px] sm:px-2 sm:py-2.5">Full Name</th>
                        <th className="w-[78px] px-1 py-2 sm:w-[96px] sm:px-2 sm:py-2.5">Phone</th>
                        <th className="w-[58px] px-1 py-2 text-center sm:w-[64px] sm:px-2 sm:py-2.5">Guests</th>
                        <th className="w-[78px] px-1 py-2 sm:w-[96px] sm:px-2 sm:py-2.5">Table</th>
                        <th className="w-[86px] px-1 py-2 text-center sm:w-[104px] sm:px-2 sm:py-2.5">Confirm</th>
                        <th className="w-[94px] px-1 py-2 text-center sm:w-[116px] sm:px-2 sm:py-2.5">Status</th>
                        <th className="w-[26px] px-1 py-2 sm:w-[34px] sm:py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eadbd6]">
                      {bookingRows.map((reservation) => (
                        <tr
                          key={reservation.id}
                          className="bg-white/50 transition hover:bg-[#fff8ec]"
                        >
                          <td className="px-1.5 py-1.5 text-[10px] font-black text-[#2b211f] sm:px-2 sm:py-2 sm:text-[12px]">
                            {reservation.time}
                          </td>
                          <td className="px-1.5 py-1.5 sm:px-2 sm:py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(reservation)}
                              className="block max-w-full truncate text-left text-[10px] font-black leading-none text-[#2b211f] transition hover:text-[#8f3f38] sm:text-[12px]"
                            >
                              {reservation.fullName}
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-[10px] font-black text-[#2b211f] sm:px-2 sm:py-2 sm:text-[12px]">
                            {reservation.phone}
                          </td>
                          <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                            <input
                              type="number"
                              min="1"
                              value={reservation.guests}
                              onChange={(event) =>
                                updateBookingRow(reservation.id, {
                                  guests: Number(event.target.value) || 1,
                                })
                              }
                              className="mx-auto h-7 w-[38px] rounded-[10px] border border-[#ead6ce] bg-white px-1 text-center text-[10px] font-black text-[#2b211f] outline-none focus:border-[#ffdb57] sm:h-8 sm:w-[50px] sm:rounded-[12px] sm:px-2 sm:text-[12px]"
                            />
                          </td>
                          <td className="px-1 py-1.5 sm:px-2 sm:py-2">
                            <input
                              value={reservation.table}
                              onChange={(event) =>
                                updateBookingRow(reservation.id, {
                                  table: event.target.value,
                                })
                              }
                              className="h-7 w-full rounded-[10px] border border-[#ead6ce] bg-white px-2 text-[10px] font-black text-[#2b211f] outline-none focus:border-[#ffdb57] sm:h-8 sm:rounded-[12px] sm:px-3 sm:text-[12px]"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                updateBookingRow(reservation.id, {
                                  confirmedAt: getConfirmStamp(),
                                });
                              }}
                              className="inline-flex h-7 min-w-[70px] items-center justify-center rounded-full border border-[#ead6ce] bg-white px-2 text-[9px] font-black text-[#2b211f] transition hover:bg-[#fff8dd] sm:h-8 sm:min-w-[90px] sm:px-4 sm:text-[11px]"
                            >
                              {reservation.confirmedAt ?? "Confirm"}
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (reservation.status === "Pending") {
                                  setBookingStatus(reservation, "Arrived");
                                  return;
                                }
                                setStatusBooking(reservation);
                              }}
                              className={`inline-flex h-7 min-w-[82px] items-center justify-center rounded-full border px-2 text-[9px] font-black sm:h-8 sm:min-w-[100px] sm:px-4 sm:text-[11px] ${getBookingStatusClass(reservation.status)}`}
                            >
                              {getStatusLabel(reservation)}
                            </button>
                          </td>
                          <td className="px-1 py-1.5 text-center sm:px-2 sm:py-2.5">
                            <button
                              type="button"
                              onClick={() => setStatusBooking(reservation)}
                              className="grid h-6 w-6 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57] sm:h-7 sm:w-7"
                              aria-label={`Change status for ${reservation.fullName}`}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-5 lg:p-8">
                <div className="grid grid-cols-7 overflow-hidden rounded-[24px] border border-[#eadbd6] bg-white/70">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="border-b border-[#eadbd6] bg-[#f5ebe5] px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]"
                      >
                        {day}
                      </div>
                    ),
                  )}

                  {monthDays.map((cell) => {
                    const active =
                      cell.day && Number(selectedDate.slice(-2)) === cell.day;
                    const isToday = cell.dateValue === todayValue;
                    const disabledCalendarDate = !cell.day || !cell.dateValue || cell.dateValue < todayValue;
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={disabledCalendarDate}
                        onClick={() => {
                          if (!cell.dateValue || disabledCalendarDate) return;
                          setSelectedDate(cell.dateValue);
                          setReservationView("table");
                        }}
                        className={`relative min-h-[112px] border-b border-r border-[#eadbd6] p-3 transition ${!cell.day ? "cursor-default bg-[#fbf5ef]/70" : disabledCalendarDate ? "cursor-not-allowed bg-[#f0e5df]/50 opacity-55" : "cursor-pointer bg-white/55 hover:bg-[#fff8dd]"} ${active ? "bg-[#fff4c8]" : ""} ${isToday ? "ring-1 ring-inset ring-[#9b4439]" : ""}`}
                      >
                        {cell.day ? (
                          <>
                            <span
                              className={`absolute left-3 top-3 inline-flex min-w-[34px] items-center justify-center rounded-full px-2 py-1 text-[15px] font-black ${isToday ? "bg-[#9b4439] text-white" : "text-[#2b211f]"}`}
                            >
                              {cell.day}
                            </span>
                            <span
                              className={`mx-auto mt-7 grid h-14 w-14 place-items-center rounded-full text-[24px] font-black ${isToday ? "bg-[#9b4439] text-white" : cell.total > 0 ? "bg-[#ffdb57] text-[#2b211f]" : "bg-[#f0e5df] text-[#8a746f]"}`}
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

        {eventCreationModalOpen ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[#2b1714]/45 px-4 py-6 backdrop-blur-sm"
            onClick={() => setEventCreationModalOpen(false)}
          >
            <div
              className="w-full max-w-[700px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff9f4] text-[#2b211f] shadow-2xl shadow-[#5f2b26]/25"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
                <div>
                  <h3 className="text-[24px] font-black tracking-[-0.045em]">
                    Create Event
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEventCreationModalOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#5a302b] transition hover:bg-[#ffdb57]"
                  aria-label="Close create event"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Event name
                  </span>
                  <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,430px)_52px] sm:items-center">
                    <input
                      type="text"
                      placeholder="Event title"
                      className="w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateEventFavorite((value) => !value)}
                      className={`grid h-[48px] w-[52px] place-items-center rounded-[16px] border transition ${createEventFavorite ? "border-[#ffdb57] bg-[#ffdb57] text-[#2b211f]" : "border-[#ead6ce] bg-white text-[#8f3f38] hover:bg-[#fff7f1]"}`}
                      aria-label="Set as favorite event"
                    >
                      <Star size={20} fill={createEventFavorite ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>

                <label className="block sm:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Description
                  </span>
                  <input
                    type="text"
                    placeholder="Short event description"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Date
                  </span>
                  <input
                    type="date"
                    min={todayValue}
                    defaultValue={selectedDate}
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Time
                  </span>
                  <input
                    type="time"
                    defaultValue={selectedTime}
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Expected guests
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="40"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Tables
                  </span>
                  <input
                    type="text"
                    placeholder="8/20"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>


              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#eadbd6] px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEventCreationModalOpen(false)}
                  className="rounded-[16px] border border-[#ead6ce] bg-white px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#6b5651] transition hover:bg-[#fff7f1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setEventCreationModalOpen(false)}
                  className="rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02]"
                >
                  Save event
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {reservationModalOpen ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[#2b1714]/45 px-4 py-6 backdrop-blur-sm"
            onClick={() => setReservationModalOpen(false)}
          >
            <div
              className="w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff9f4] text-[#2b211f] shadow-2xl shadow-[#5f2b26]/25"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
                <div>
                  <h3 className="text-[24px] font-black tracking-[-0.045em]">
                    Reservation details
                  </h3>
                  <p className="mt-1 text-[13px] font-bold text-[#8a746f]">
                    {selectedEvent
                      ? `${selectedEvent.title} · ${selectedEvent.dateLabel} · ${selectedEvent.timeLabel}`
                      : `${selectedDateLabel} · ${selectedTime}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReservationModalOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#5a302b] transition hover:bg-[#ffdb57]"
                  aria-label="Close reservation details"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                {selectedEvent ? (
                  <div className="sm:col-span-2 rounded-[18px] bg-[#fff1cf] px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                      Event
                    </p>
                    <p className="mt-1 text-[14px] font-black text-[#2b211f]">
                      {selectedEvent.title} · {selectedEvent.dateLabel} · {selectedEvent.timeLabel} · {selectedEvent.guests} · {selectedEvent.tables}
                    </p>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Phone
                  </span>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Full name
                  </span>
                  <input
                    type="text"
                    placeholder="Customer name"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Guests
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="2"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Table
                  </span>
                  <input
                    type="text"
                    placeholder="Indoor 12"
                    className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                {!selectedEvent ? (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                        Date
                      </span>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) => {
                          if (event.target.value) setSelectedDate(event.target.value);
                        }}
                        className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                        Time
                      </span>
                      <input
                        type="time"
                        value={selectedTime}
                        onChange={(event) => {
                          if (event.target.value) setSelectedTime(event.target.value);
                        }}
                        className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                      />
                    </label>
                  </>
                ) : null}

                <label className="block sm:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    Notes
                  </span>
                  <textarea
                    rows={3}
                    placeholder="Special requests or notes"
                    className="mt-2 w-full resize-none rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-[14px] font-bold outline-none transition focus:border-[#ffdb57]"
                  />
                </label>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1 text-[13px] font-black text-[#2b211f]">
                  <span className="mr-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                    History
                  </span>
                  <span className="rounded-full bg-[#fff7f1] px-3 py-1.5">
                    15 bookings
                  </span>
                  <span className="rounded-full bg-[#ffe3df] px-3 py-1.5 text-[#9b4439]">
                    3 No Show
                  </span>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-[#eadbd6] px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setReservationModalOpen(false)}
                  className="rounded-[16px] border border-[#ead6ce] bg-white px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#6b5651] transition hover:bg-[#fff7f1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setReservationModalOpen(false)}
                  className="rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02]"
                >
                  Save reservation
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {statusBooking ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[#2b1714]/45 px-4 py-6 backdrop-blur-sm"
            onClick={() => setStatusBooking(null)}
          >
            <div
              className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff9f4] text-[#2b211f] shadow-2xl shadow-[#5f2b26]/25"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-5 py-4">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.045em]">Change status</h3>
                  <p className="mt-1 text-[12px] font-black uppercase tracking-[0.08em] text-[#8a746f]">{statusBooking.fullName}</p>
                </div>
                <button type="button" onClick={() => setStatusBooking(null)} className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]" aria-label="Close status popup">
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-3 px-5 py-5">
                {(["Pending", "Arrived", "No Show", "Cancelled", "Late"] as Reservation["status"][]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setBookingStatus(statusBooking, status);
                      setStatusBooking(null);
                    }}
                    className={`flex min-h-[44px] items-center justify-between rounded-[16px] border px-4 text-[13px] font-black ${getBookingStatusClass(status)}`}
                  >
                    <span>{status}</span>
                    {status === "Arrived" ? <span>{statusBooking.arrivedAt || getNowTimeLabel()}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {selectedBooking ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-[#2b1714]/45 px-4 py-6 backdrop-blur-sm"
            onClick={() => setSelectedBooking(null)}
          >
            <div
              className="w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff9f4] text-[#2b211f] shadow-2xl shadow-[#5f2b26]/25"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
                <div>
                  <h3 className="text-[20px] font-black tracking-[-0.045em]">Reservation details</h3>
                </div>
                <button type="button" onClick={() => setSelectedBooking(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#5a302b] transition hover:bg-[#ffdb57]" aria-label="Close reservation details">
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Client name</span>
                  <input value={selectedBooking.fullName} onChange={(event) => { updateBookingRow(selectedBooking.id, { fullName: event.target.value }); setSelectedBooking({ ...selectedBooking, fullName: event.target.value }); }} className="mt-2 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-left text-[14px] font-bold outline-none transition focus:border-[#ffdb57]" />
                </label>
                <label className="block rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Phone</span>
                  <input value={selectedBooking.phone} onChange={(event) => { updateBookingRow(selectedBooking.id, { phone: event.target.value }); setSelectedBooking({ ...selectedBooking, phone: event.target.value }); }} className="mt-2 w-full rounded-[12px] border border-[#ead6ce] bg-white px-3 py-2 text-[13px] font-black outline-none focus:border-[#ffdb57]" />
                </label>
                <label className="block rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Guests</span>
                  <input type="number" min="1" value={selectedBooking.guests} onChange={(event) => { const guests = Number(event.target.value) || 1; updateBookingRow(selectedBooking.id, { guests }); setSelectedBooking({ ...selectedBooking, guests }); }} className="mt-2 w-full rounded-[12px] border border-[#ead6ce] bg-white px-3 py-2 text-[13px] font-black outline-none focus:border-[#ffdb57]" />
                </label>
                <label className="block rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Table</span>
                  <input value={selectedBooking.table} onChange={(event) => { updateBookingRow(selectedBooking.id, { table: event.target.value }); setSelectedBooking({ ...selectedBooking, table: event.target.value }); }} className="mt-2 w-full rounded-[12px] border border-[#ead6ce] bg-white px-3 py-2 text-[13px] font-black outline-none focus:border-[#ffdb57]" />
                </label>
                <div className="rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Status</p>
                  <p className="mt-3 text-[14px] font-black">{getStatusLabel(selectedBooking)}</p>
                </div>
                <button type="button" onClick={() => { const stamp = getConfirmStamp(); updateBookingRow(selectedBooking.id, { confirmedAt: stamp }); setSelectedBooking({ ...selectedBooking, confirmedAt: stamp }); }} className="rounded-[18px] border border-[#ead6ce] bg-white/60 p-4 text-left transition hover:bg-[#fff8dd]">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Confirmed</span>
                  <span className="mt-2 block text-[13px] font-black">{selectedBooking.confirmedAt || "Press to add contact time"}</span>
                </button>
                <div className="rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Booking time</p>
                  <p className="mt-3 text-[14px] font-black">{selectedBooking.time}</p>
                </div>
                <label className="block sm:col-span-2 rounded-[18px] border border-[#ead6ce] bg-white/60 p-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">Notes</span>
                  <textarea rows={2} defaultValue="Prefers a table close to the screen." className="mt-2 w-full resize-none rounded-[12px] border border-[#ead6ce] bg-white px-3 py-2 text-[13px] font-bold outline-none focus:border-[#ffdb57]" />
                </label>
              </div>
            </div>
          </div>
        ) : null}


        {shareFallbackOpen ? (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 backdrop-blur-sm"
            onClick={() => setShareFallbackOpen(false)}
          >
            <div
              className="w-full max-w-[420px] rounded-[24px] border border-[#ead6ce] bg-[#fffaf5] p-6 text-[#2b211f] shadow-2xl shadow-black/20"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-[22px] font-black tracking-[-0.04em]">
                Share reservations
              </h3>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[#7a605a]">
                Share the selected date reservations as a CSV file.
              </p>
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    await shareSelectedDateCsv();
                    setShareFallbackOpen(false);
                  }}
                  className="w-full rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f]"
                >
                  Share CSV
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="pb-8 text-center text-[14px] font-medium text-[#7a605a]">
          Need help?{" "}
          <span className="font-black text-[#9a5048]">Contact support</span>
        </footer>
      </div>
    </main>
  );
}
