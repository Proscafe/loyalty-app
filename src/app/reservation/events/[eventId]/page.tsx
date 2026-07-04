"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  OctagonX,
  Pencil,
  Share2,
  Star,
  Table2,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

const RESERVATION_ALLOWED_ROLES = new Set(["admin", "staff", "master_admin", "master-admin", "master admin"]);

function normalizeReservationRole(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function isReservationAllowedRole(value?: string | null) {
  const role = normalizeReservationRole(value);
  return (
    RESERVATION_ALLOWED_ROLES.has(role) ||
    role.includes("admin") ||
    role.includes("staff")
  );
}

async function getReservationAccessRole(supabase: ReturnType<typeof createClient>) {
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) return { allowed: false, reason: "no-user" as const };

  let role = normalizeReservationRole(user.app_metadata?.role ?? user.user_metadata?.role);

  try {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("role,user_role,type")
      .eq("id", user.id)
      .maybeSingle();

    role = normalizeReservationRole(profileById?.role ?? profileById?.user_role ?? profileById?.type ?? role);
  } catch {
    // Keep metadata role fallback when the profiles table is unavailable.
  }

  if (!role) {
    try {
      const { data: profileByUserId } = await supabase
        .from("profiles")
        .select("role,user_role,type")
        .eq("user_id", user.id)
        .maybeSingle();

      role = normalizeReservationRole(profileByUserId?.role ?? profileByUserId?.user_role ?? profileByUserId?.type ?? role);
    } catch {
      // Some projects use id instead of user_id. Keep the current fallback.
    }
  }

  // If the user is authenticated but the client cannot read a role because of RLS
  // or a different profile schema, allow the page to load instead of creating a
  // login <-> reservation redirect loop. Explicit non-staff roles are still blocked.
  if (!role) return { allowed: true, reason: "role" as const };

  return { allowed: isReservationAllowedRole(role), reason: "role" as const };
}

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
  status: "Pending" | "Arrived" | "No Show" | "Cancelled" | "Late";
  confirmedAt?: string;
  arrivedAt?: string;
  bookedAt: string;
  notes: string;
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
    pinned: true,
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
  "Abed Usta",
  "Anthony Saliba",
  "Alain Khoury",
  "Batoul Daher",
  "Carla Nassar",
  "Charbel Azar",
  "Dana Younes",
  "Dany Matar",
  "Elie Hajj",
  "Elias Aoun",
  "Fadi Nehme",
  "Farah Haddad",
  "Georges Nader",
  "Ghina Saab",
  "Hussein Yassine",
  "Hadi Mansour",
  "Ibrahim Karam",
  "Imad Farah",
  "Jad Bou Saab",
  "Joelle Sfeir",
  "Karim Saab",
  "Karen Khoury",
  "Lara Mansour",
  "Lea Chemaly",
  "Maya Karam",
  "Marc Abi Rached",
  "Mira Sfeir",
  "Mireille Haddad",
  "Nadine Farah",
  "Nour Hajj",
  "Omar Khalil",
  "Oussama Raad",
  "Paula Khoury",
  "Pierre Lahoud",
  "Ralph Saliba",
  "Rita Chemaly",
  "Rony Haddad",
  "Sarah Ghanem",
  "Samer Daher",
  "Sandro Akl",
  "Tania Habib",
  "Toufic Tandouri",
  "Tarek Saade",
  "Ursula Nehme",
  "Victor Khoury",
  "Vanessa Saab",
  "Walid Rahme",
  "Wissam Mantoufeh",
  "Yara Nader",
  "Youssef Karam",
  "Ziad Haddad",
  "Zeina Mansour",
  "Michel Aoun",
  "Nabil Farhat",
  "Rami Akl",
  "Sally Azar",
  "Lina Barakat",
  "Joseph Haddad",
  "Christelle Hayek",
  "Bassem Khoury",
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
  "Indoor 18",
  "Terrace 11",
  "Lounge 1",
  "Garden 4",
  "VIP 6",
  "Indoor 22",
  "Terrace 14",
  "Lounge 10",
  "Garden 9",
];

function buildMockReservations(eventId: string): EventReservation[] {
  const offset = eventId === "football-night" ? 2 : eventId === "sunset-dinner" ? 1 : 0;
  const statusPattern: EventReservation["status"][] = [
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
    "Pending",
  ];

  return guestNames.map((fullName, index) => ({
    id: `mock-${eventId}-${index + 1}`,
    fullName,
    phone: `0${3 + ((index + offset) % 7)} ${String(720000 + index * 2713 + offset * 407).slice(0, 3)} ${String(210 + index * 17).padStart(3, "0")}`,
    guests: ((index + offset) % 8) + 1,
    table: tables[(index + offset) % tables.length],
    status: statusPattern[(index + offset) % statusPattern.length],
    bookedAt: `${String(10 + ((index + offset) % 10)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "45"}`,
    notes:
      index % 5 === 0
        ? "Prefers a table close to the screen."
        : index % 4 === 0
          ? "Birthday group, bring cake later."
          : "No special notes.",
  }));
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
  if (status === "Arrived") return "bg-[#dff7ea] text-[#22633d] border border-[#bde9cf]";
  if (status === "No Show") return "bg-[#ffe0dc] text-[#9a332b] border border-[#f2bcb4]";
  if (status === "Cancelled") return "bg-[#e8e3df] text-[#5f5551] border border-[#d6cbc5]";
  if (status === "Late") return "bg-[#fff0d7] text-[#9d551f] border border-[#f4d09f]";
  return "bg-[#fff1b8] text-[#6f4a00] border border-[#f0d46b]";
}

function formatNowDateTime() {
  const now = new Date();
  const date = `${now.getDate()}/${now.getMonth() + 1}`;
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${date} - ${time}`;
}

function getConfirmedTimeLabel(confirmedAt?: string) {
  if (!confirmedAt) return "";
  const parts = confirmedAt.split(" - ");
  return parts.length > 1 ? parts[parts.length - 1] : confirmedAt;
}

function formatNowTime() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}


function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "event";
}

export default function EventReservationDetailsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [accessStatus, setAccessStatus] = useState<"checking" | "allowed">("checking");
  const params = useParams<{ eventId: string }>();
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const event = events.find((item) => item.id === eventId) ?? events[0];
  const reservations = useMemo(() => buildMockReservations(event.id), [event.id]);
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({});
  const [guestEdits, setGuestEdits] = useState<Record<string, number>>({});
  const [tableEdits, setTableEdits] = useState<Record<string, string>>({});
  const [confirmEdits, setConfirmEdits] = useState<Record<string, string>>({});
  const [confirmHistoryEdits, setConfirmHistoryEdits] = useState<Record<string, string[]>>({});
  const [statusEdits, setStatusEdits] = useState<
    Record<string, { status: EventReservation["status"]; arrivedAt?: string; reason?: string }>
  >({});
  const [selectedReservation, setSelectedReservation] = useState<EventReservation | null>(null);
  const [statusReservation, setStatusReservation] = useState<EventReservation | null>(null);
  const [activeGuestFilter, setActiveGuestFilter] = useState<number | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<EventReservation["status"] | null>(null);
  const [activeConfirmedFilter, setActiveConfirmedFilter] = useState(false);
  const [eventTitle, setEventTitle] = useState(event.title);
  const [eventDescription, setEventDescription] = useState(event.description);
  const [eventDate, setEventDate] = useState(event.isoDate);
  const [eventTime, setEventTime] = useState(event.timeLabel);
  const [eventGuests, setEventGuests] = useState(event.guests.replace(/\s*guests/i, ""));
  const [eventTables, setEventTables] = useState(event.tables.replace(/\s*tables/i, ""));
  const [eventEntry, setEventEntry] = useState(event.price);
  const [eventFavorite, setEventFavorite] = useState(Boolean(event.pinned));
  const [eventEditOpen, setEventEditOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [quickReservationOpen, setQuickReservationOpen] = useState(false);
  const [quickReservationPhone, setQuickReservationPhone] = useState("");
  const [quickReservationName, setQuickReservationName] = useState("");
  const [quickReservationGuests, setQuickReservationGuests] = useState("2");
  const [quickReservationTable, setQuickReservationTable] = useState("");
  const [quickReservationNotes, setQuickReservationNotes] = useState("");
  const [shareFallbackOpen, setShareFallbackOpen] = useState(false);
  const [shareFileUrl, setShareFileUrl] = useState("");
  const [shareFileName, setShareFileName] = useState("");
  const reservationTableRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      const access = await getReservationAccessRole(supabase);

      if (!access.allowed) {
        if (access.reason === "no-user") {
          router.replace(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
          return;
        }

        router.replace("/login?unauthorized=1");
        return;
      }

      if (mounted) setAccessStatus("allowed");
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const displayEvent = useMemo(
    () => ({
      ...event,
      title: eventTitle,
      description: eventDescription,
      isoDate: eventDate,
      timeLabel: eventTime,
      guests: `${eventGuests || 0} guests`,
      tables: `${eventTables || "0/0"} tables`,
      price: eventEntry,
      pinned: eventFavorite,
      dateLabel: new Date(`${eventDate}T00:00:00`).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      dayLabel: new Date(`${eventDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
      }),
    }),
    [event, eventDate, eventDescription, eventEntry, eventFavorite, eventGuests, eventTables, eventTime, eventTitle],
  );

  function getEventReservationsCsvFile() {
    const header = [
      "Event",
      "Date",
      "Time",
      "Full Name",
      "Phone",
      "Guests",
      "Table",
      "Confirmed",
      "Status",
      "Notes",
    ];

    const escapeCsv = (value: string | number) => {
      const text = String(value ?? "");
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const body = rows.map((reservation) =>
      [
        displayEvent.title,
        displayEvent.dateLabel,
        displayEvent.timeLabel,
        reservation.fullName,
        reservation.phone,
        reservation.guests,
        reservation.table,
        reservation.confirmedAt || "",
        reservation.status === "Arrived" && reservation.arrivedAt
          ? `Arrived - ${getConfirmedTimeLabel(reservation.arrivedAt)}`
          : reservation.status,
        reservation.notes,
      ]
        .map(escapeCsv)
        .join(","),
    );

    const csv = [header.map(escapeCsv).join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    return new File([blob], `${safeFileName(displayEvent.title)}-reservations.csv`, {
      type: "text/csv",
    });
  }

  function getEventReservationsExcelFile() {
    const printableRows = rows
      .map(
        (reservation) => `
          <tr>
            <td>${escapeHtml(reservation.fullName)}</td>
            <td>${escapeHtml(reservation.phone)}</td>
            <td>${escapeHtml(reservation.guests)}</td>
            <td>${escapeHtml(reservation.table)}</td>
            <td>${escapeHtml(reservation.confirmedAt || "")}</td>
            <td>${escapeHtml(reservation.status === "Arrived" && reservation.arrivedAt ? `Arrived - ${getConfirmedTimeLabel(reservation.arrivedAt)}` : reservation.status)}</td>
            <td>${escapeHtml(reservation.notes)}</td>
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
          <h1>${escapeHtml(displayEvent.title)}</h1>
          <p>${escapeHtml(displayEvent.dayLabel)} - ${escapeHtml(displayEvent.dateLabel)} - ${escapeHtml(displayEvent.timeLabel)} | ${escapeHtml(rows.length)} reservations | ${escapeHtml(totals.guests)} guests</p>
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Phone</th>
                <th>Guests</th>
                <th>Table</th>
                <th>Confirmed</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${printableRows}</tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    return new File([blob], `${safeFileName(displayEvent.title)}-reservations.xls`, {
      type: "application/vnd.ms-excel",
    });
  }

  async function shareEvent() {
    const file = getEventReservationsCsvFile();
    const shareData: ShareData & { files?: File[] } = {
      title: displayEvent.title,
      text: `${displayEvent.title} reservation table CSV`,
      files: [file],
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share(shareData);
          return;
        }
        await navigator.share({
          title: displayEvent.title,
          text: `${displayEvent.title} reservation table CSV`,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    if (shareFileUrl) URL.revokeObjectURL(shareFileUrl);
    const url = URL.createObjectURL(file);
    setShareFileUrl(url);
    setShareFileName(file.name);
    setShareFallbackOpen(true);
  }

  function downloadReservationsExcel() {
    const file = getEventReservationsExcelFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function uploadReservationsCsv(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || "");
      const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length <= 1) return;

      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
      const getIndex = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const nameIndex = getIndex("full name", "name", "client name");
      const phoneIndex = getIndex("phone", "phone number", "number");
      const guestsIndex = getIndex("guests", "guest count", "people");
      const tableIndex = getIndex("table", "table name");
      const statusIndex = getIndex("status");
      const notesIndex = getIndex("notes", "note");

      lines.slice(1).forEach((line, index) => {
        const values = parseCsvLine(line);
        const reservation = rows[index];
        if (!reservation) return;

        if (nameIndex >= 0 && values[nameIndex]) {
          setNameEdits((current) => ({ ...current, [reservation.id]: values[nameIndex] }));
        }
        if (phoneIndex >= 0 && values[phoneIndex]) {
          setPhoneEdits((current) => ({ ...current, [reservation.id]: values[phoneIndex] }));
        }
        if (guestsIndex >= 0 && values[guestsIndex]) {
          setGuestEdits((current) => ({ ...current, [reservation.id]: Math.max(1, Number(values[guestsIndex]) || reservation.guests) }));
        }
        if (tableIndex >= 0 && values[tableIndex]) {
          setTableEdits((current) => ({ ...current, [reservation.id]: values[tableIndex] }));
        }
        if (statusIndex >= 0 && values[statusIndex]) {
          const nextStatus = values[statusIndex] as EventReservation["status"];
          if (["Pending", "Arrived", "No Show", "Cancelled", "Late"].includes(nextStatus)) {
            setStatusEdits((current) => ({
              ...current,
              [reservation.id]: {
                status: nextStatus,
                arrivedAt: nextStatus === "Arrived" ? formatNowDateTime() : undefined,
              },
            }));
          }
        }
        if (notesIndex >= 0 && values[notesIndex]) {
          // Notes will be connected to the database later. This keeps CSV import ready without changing mock source notes.
        }
      });

      if (uploadInputRef.current) uploadInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function scrollToLetter(letter: string) {
    const container = reservationTableRef.current;
    const target = document.getElementById(`reservation-letter-${letter}`);

    if (!container || !target) return;

    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const headerOffset = 39;

    container.scrollTo({
      top: container.scrollTop + targetTop - containerTop - headerOffset,
      behavior: "smooth",
    });
  }

  function confirmClient(reservationId: string) {
    const confirmedAt = formatNowDateTime();
    setConfirmEdits((current) => ({
      ...current,
      [reservationId]: confirmedAt,
    }));
    setConfirmHistoryEdits((current) => ({
      ...current,
      [reservationId]: [...(current[reservationId] ?? []), confirmedAt],
    }));
  }

  function getConfirmHistory(reservation: EventReservation) {
    return [
      ...(reservation.confirmedAt ? [reservation.confirmedAt] : []),
      ...(confirmHistoryEdits[reservation.id] ?? []),
    ];
  }

  function updateStatus(
    reservationId: string,
    status: EventReservation["status"],
    reason?: string,
  ) {
    setStatusEdits((current) => ({
      ...current,
      [reservationId]: {
        status,
        arrivedAt: status === "Arrived" ? formatNowDateTime() : undefined,
        reason,
      },
    }));
    setStatusReservation(null);
  }

  const rows = useMemo(
    () =>
      reservations
        .map((reservation) => {
          const statusUpdate = statusEdits[reservation.id];
          return {
            ...reservation,
            fullName: nameEdits[reservation.id] ?? reservation.fullName,
            phone: phoneEdits[reservation.id] ?? reservation.phone,
            guests: guestEdits[reservation.id] ?? reservation.guests,
            table: tableEdits[reservation.id] ?? reservation.table,
            status: statusUpdate?.status ?? reservation.status,
            confirmedAt: confirmEdits[reservation.id] ?? reservation.confirmedAt,
            arrivedAt: statusUpdate?.arrivedAt ?? reservation.arrivedAt,
            notes: statusUpdate?.reason ? `${reservation.notes} Reason: ${statusUpdate.reason}` : reservation.notes,
          };
        })
        .sort((a, b) => {
          const aCancelled = a.status === "Cancelled";
          const bCancelled = b.status === "Cancelled";
          if (aCancelled !== bCancelled) return aCancelled ? 1 : -1;
          return a.fullName.localeCompare(b.fullName);
        }),
    [confirmEdits, guestEdits, nameEdits, phoneEdits, reservations, statusEdits, tableEdits],
  );

  const totals = useMemo(() => {
    const guests = rows.reduce((sum, reservation) => sum + reservation.guests, 0);
    const tableCount = rows.length;
    const confirmed = rows.filter((reservation) => getConfirmHistory(reservation).length > 0).length;
    const arrived = rows.filter((reservation) => reservation.status === "Arrived").length;
    const noShows = rows.filter((reservation) => reservation.status === "No Show").length;
    const pending = rows.filter((reservation) => reservation.status === "Pending").length;
    const cancelled = rows.filter((reservation) => reservation.status === "Cancelled").length;
    return { guests, tableCount, confirmed, arrived, noShows, pending, cancelled };
  }, [rows]);

  const guestSizeBreakdown = useMemo(() => {
    const groups = rows.reduce<Record<number, number>>((acc, reservation) => {
      acc[reservation.guests] = (acc[reservation.guests] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(groups)
      .map(([guestCount, tableCount]) => ({
        guestCount: Number(guestCount),
        tableCount: Number(tableCount),
      }))
      .sort((a, b) => b.tableCount - a.tableCount || a.guestCount - b.guestCount);
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((reservation) => {
      const guestMatch = activeGuestFilter ? reservation.guests === activeGuestFilter : true;
      const statusMatch = activeStatusFilter ? reservation.status === activeStatusFilter : true;
      const confirmedMatch = activeConfirmedFilter ? getConfirmHistory(reservation).length > 0 : true;
      return guestMatch && statusMatch && confirmedMatch;
    });
  }, [activeConfirmedFilter, activeGuestFilter, activeStatusFilter, rows]);

  const alphabetLetters = useMemo(() => {
    return Array.from(new Set(visibleRows.map((reservation) => reservation.fullName.charAt(0).toUpperCase()))).sort();
  }, [visibleRows]);

  const firstLetterTracker = new Set<string>();

  if (accessStatus !== "allowed") {
    return (
      <main className="min-h-screen bg-[#fbf5ef]" />
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf5ef] text-[#22110f]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(255,217,82,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(166,93,82,0.15),transparent_26%),linear-gradient(135deg,#fff8f1_0%,#fbf2eb_46%,#f5e4dc_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col px-4 py-3 sm:px-8 lg:px-14 lg:py-5">
        <section className="mb-5 hidden flex-col gap-2 sm:flex lg:gap-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.push("/reservation")}
              className="inline-flex items-center gap-2 rounded-[15px] border border-[#ead6ce] bg-white/80 px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.1em] text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex flex-col items-end gap-3 lg:gap-2">
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shareEvent}
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
                aria-label="Share event"
              >
                <Share2 size={17} />
              </button>
              <button
                type="button"
                onClick={downloadReservationsExcel}
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
                aria-label="Download reservations"
              >
                <Download size={17} />
              </button>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
                aria-label="Upload reservations"
              >
                <Upload size={17} />
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => uploadReservationsCsv(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => setEventEditOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-[14px] border border-[#ead6ce] bg-white/80 text-[#5a302b] shadow-sm transition hover:bg-[#ffdb57]"
                aria-label="Edit event"
              >
                <Pencil size={17} />
              </button>
              </div>

              <button
                type="button"
                onClick={() => setQuickReservationOpen(true)}
                className="inline-flex w-fit items-center justify-center rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02] lg:hidden"
              >
                Add Reservation
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#7a605a]">
                <span>{displayEvent.dayLabel}</span>
                <span className="text-[#c5aaa1]">-</span>
                <span>{displayEvent.dateLabel}</span>
                <span className="text-[#c5aaa1]">-</span>
                <span>{displayEvent.timeLabel}</span>
              </div>

              <h1 className="mt-2 text-[32px] font-black leading-[0.95] tracking-[-0.055em] text-[#351614]">
                {displayEvent.title}
              </h1>

              <p className="mt-3 max-w-[760px] text-[13px] font-bold leading-snug text-[#7a605a]">
                {displayEvent.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setQuickReservationOpen(true)}
              className="hidden w-fit shrink-0 items-center justify-center rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02] lg:inline-flex"
            >
              Add Reservation
            </button>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-7 gap-1.5 overflow-x-auto pb-1 sm:gap-2 sm:overflow-visible">
          <article className="min-w-[92px] rounded-[14px] border border-[#ead6ce] bg-white/88 p-2.5 shadow-md shadow-[#9a5048]/10 sm:min-w-0 sm:p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Tables</p>
              <Table2 size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.tableCount}</p>
          </article>

          <article className="min-w-[92px] rounded-[14px] border border-[#ead6ce] bg-white/88 p-2.5 shadow-md shadow-[#9a5048]/10 sm:min-w-0 sm:p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Guests</p>
              <Users size={14} className="text-[#8f3f38]" fill="currentColor" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.guests}</p>
          </article>

          <button
            type="button"
            onClick={() => {
              setActiveGuestFilter(null);
              setActiveStatusFilter(null);
              setActiveConfirmedFilter((current) => !current);
            }}
            className={`min-w-[92px] rounded-[14px] border p-2.5 text-left shadow-md shadow-[#9a5048]/10 transition hover:-translate-y-0.5 sm:min-w-0 sm:p-3 ${activeConfirmedFilter ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/88"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Confirmed</p>
              <UserRound size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.confirmed}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveGuestFilter(null);
              setActiveConfirmedFilter(false);
              setActiveStatusFilter((current) => (current === "Arrived" ? null : "Arrived"));
            }}
            className={`min-w-[92px] rounded-[14px] border p-2.5 text-left shadow-md shadow-[#9a5048]/10 transition hover:-translate-y-0.5 sm:min-w-0 sm:p-3 ${activeStatusFilter === "Arrived" ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/88"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Arrived</p>
              <UserRound size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.arrived}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveGuestFilter(null);
              setActiveConfirmedFilter(false);
              setActiveStatusFilter((current) => (current === "Pending" ? null : "Pending"));
            }}
            className={`min-w-[92px] rounded-[14px] border p-2.5 text-left shadow-md shadow-[#9a5048]/10 transition hover:-translate-y-0.5 sm:min-w-0 sm:p-3 ${activeStatusFilter === "Pending" ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/88"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Pending</p>
              <UserRound size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.pending}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveGuestFilter(null);
              setActiveConfirmedFilter(false);
              setActiveStatusFilter((current) => (current === "No Show" ? null : "No Show"));
            }}
            className={`min-w-[92px] rounded-[14px] border p-2.5 text-left shadow-md shadow-[#9a5048]/10 transition hover:-translate-y-0.5 sm:min-w-0 sm:p-3 ${activeStatusFilter === "No Show" ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/88"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">No Show</p>
              <OctagonX size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.noShows}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveGuestFilter(null);
              setActiveConfirmedFilter(false);
              setActiveStatusFilter((current) => (current === "Cancelled" ? null : "Cancelled"));
            }}
            className={`min-w-[92px] rounded-[14px] border p-2.5 text-left shadow-md shadow-[#9a5048]/10 transition hover:-translate-y-0.5 sm:min-w-0 sm:p-3 ${activeStatusFilter === "Cancelled" ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/88"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Cancelled</p>
              <X size={14} className="text-[#8f3f38]" />
            </div>
            <p className="mt-1.5 text-[22px] font-black tracking-[-0.06em] text-[#2b211f] sm:text-[24px]">{totals.cancelled}</p>
          </button>
        </section>

        <section className="mb-10 overflow-hidden rounded-[26px] border border-[#ead6ce] bg-white/88 text-[#2b211f] shadow-xl shadow-[#9a5048]/10 backdrop-blur-md">
          <div className="border-b border-[#eadbd6] px-4 py-3 lg:px-6">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {guestSizeBreakdown.map((item) => {
                const active = activeGuestFilter === item.guestCount;
                return (
                  <button
                    key={item.guestCount}
                    type="button"
                    onClick={() => {
                      setActiveStatusFilter(null);
                      setActiveConfirmedFilter(false);
                      setActiveGuestFilter((current) =>
                        current === item.guestCount ? null : item.guestCount,
                      );
                    }}
                    className={`min-w-[82px] rounded-[12px] border px-2.5 py-1.5 text-left shadow-sm transition hover:-translate-y-0.5 ${active ? "border-[#ffdb57] bg-[#ffdb57]" : "border-[#ead6ce] bg-white/75"}`}
                  >
                    <p className="text-[9px] font-black text-[#5a302b]">
                      {item.guestCount} guest{item.guestCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-0.5 text-[12px] font-black tracking-[-0.03em] text-[#2b211f]">
                      {item.tableCount} table{item.tableCount === 1 ? "" : "s"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#eadbd6] px-4 py-3 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
            <h2 className="text-[20px] font-black tracking-[-0.04em] text-[#2b211f]">
              Reservation table
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {alphabetLetters.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => scrollToLetter(letter)}
                  className="grid h-[41px] w-[41px] place-items-center rounded-full border border-[#ead6ce] bg-white text-[15px] font-black text-[#5a302b] transition hover:bg-[#ffdb57] sm:h-[34px] sm:w-[34px] sm:text-[13px]"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={reservationTableRef}
            className="max-h-[560px] overflow-auto scroll-smooth"
          >
            <table className="min-w-[680px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f5ebe5] text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">
                  <th className="px-3 py-2 lg:px-5">Full name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2 text-center">Guests</th>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2 text-center">Confirm</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eadbd6]">
                {visibleRows.map((reservation) => {
                  const firstLetter = reservation.fullName.charAt(0).toUpperCase();
                  const isFirstForLetter = !firstLetterTracker.has(firstLetter);
                  if (isFirstForLetter) firstLetterTracker.add(firstLetter);

                  return (
                    <tr
                      key={reservation.id}
                      id={isFirstForLetter ? `reservation-letter-${firstLetter}` : undefined}
                      className="bg-white/50 transition hover:bg-[#fff8ec]"
                    >
                      <td className="px-3 py-2 lg:px-5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedReservation(reservation)}
                            className="shrink-0 text-left text-[12px] font-black text-[#2b211f] underline-offset-4 transition hover:text-[#8f3f38] hover:underline"
                          >
                            {reservation.fullName}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block whitespace-nowrap text-[12px] font-black text-[#2b211f]">
                          {reservation.phone}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={reservation.guests}
                          onChange={(event) => {
                            const nextValue = Math.max(1, Math.min(20, Number(event.target.value) || 1));
                            setGuestEdits((current) => ({
                              ...current,
                              [reservation.id]: nextValue,
                            }));
                          }}
                          className="mx-auto h-8 w-14 rounded-xl border border-[#ead6ce] bg-white px-2 text-center text-[13px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                          aria-label={`Edit guests for ${reservation.fullName}`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={reservation.table}
                          onChange={(event) =>
                            setTableEdits((current) => ({
                              ...current,
                              [reservation.id]: event.target.value,
                            }))
                          }
                          className="h-8 w-[112px] rounded-xl border border-[#ead6ce] bg-white px-3 text-[12px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                          aria-label={`Edit table for ${reservation.fullName}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => confirmClient(reservation.id)}
                          className={`inline-flex min-w-[104px] items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-black transition ${reservation.confirmedAt ? "border-[#bde9cf] bg-[#dff7ea] text-[#22633d]" : "border-[#ead6ce] bg-white text-[#2b211f] hover:bg-[#ffdb57] hover:scale-[1.02]"}`}
                        >
                          {reservation.confirmedAt ?? "Confirm"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (reservation.status === "Pending") {
                                updateStatus(reservation.id, "Arrived");
                                return;
                              }
                              setStatusReservation(reservation);
                            }}
                            className={`inline-flex min-w-[116px] items-center justify-center rounded-full px-3 py-1.5 text-[10px] font-black transition hover:scale-[1.02] ${getStatusClasses(reservation.status)}`}
                            aria-label={reservation.status === "Pending" ? `Mark ${reservation.fullName} as arrived` : `Change status for ${reservation.fullName}`}
                          >
                            {reservation.status === "Arrived" && reservation.arrivedAt
                              ? `Arrived - ${getConfirmedTimeLabel(reservation.arrivedAt)}`
                              : reservation.status}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusReservation(reservation)}
                            className="grid h-7 w-7 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                            aria-label={`Change status for ${reservation.fullName}`}
                          >
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedReservation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b211f]/40 px-4 backdrop-blur-sm"
          onClick={() => setSelectedReservation(null)}
        >
          <section
            className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff8f3] text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-[18px] font-black tracking-[-0.035em]">
                  Reservation details
                </h3>
                <label className="mt-3 block max-w-[360px]">
                  <span className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">
                    Client name
                  </span>
                  <input
                    type="text"
                    value={nameEdits[selectedReservation.id] ?? selectedReservation.fullName}
                    onChange={(event) =>
                      setNameEdits((current) => ({
                        ...current,
                        [selectedReservation.id]: event.target.value,
                      }))
                    }
                    className="mt-2 h-9 w-full rounded-xl border border-[#ead6ce] bg-white px-3 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                    aria-label="Edit client name"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReservation(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                aria-label="Close reservation details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
              <label className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4">
                <span className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Phone</span>
                <input
                  type="tel"
                  value={phoneEdits[selectedReservation.id] ?? selectedReservation.phone}
                  onChange={(event) =>
                    setPhoneEdits((current) => ({
                      ...current,
                      [selectedReservation.id]: event.target.value,
                    }))
                  }
                  className="mt-2 h-9 w-full rounded-xl border border-[#ead6ce] bg-white px-3 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  aria-label="Edit reservation phone number"
                />
              </label>
              <label className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4">
                <span className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Guests</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guestEdits[selectedReservation.id] ?? selectedReservation.guests}
                  onChange={(event) => {
                    const nextValue = Math.max(1, Math.min(20, Number(event.target.value) || 1));
                    setGuestEdits((current) => ({
                      ...current,
                      [selectedReservation.id]: nextValue,
                    }));
                  }}
                  className="mt-2 h-9 w-full rounded-xl border border-[#ead6ce] bg-white px-3 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  aria-label="Edit reservation guest count"
                />
              </label>
              <label className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4">
                <span className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Table</span>
                <input
                  type="text"
                  value={tableEdits[selectedReservation.id] ?? selectedReservation.table}
                  onChange={(event) =>
                    setTableEdits((current) => ({
                      ...current,
                      [selectedReservation.id]: event.target.value,
                    }))
                  }
                  className="mt-2 h-9 w-full rounded-xl border border-[#ead6ce] bg-white px-3 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  aria-label="Edit reservation table"
                />
              </label>
              <div className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Status</p>
                <p className="mt-2 text-[15px] font-black">{statusEdits[selectedReservation.id]?.status ?? selectedReservation.status}</p>
              </div>
              <button
                type="button"
                onClick={() => confirmClient(selectedReservation.id)}
                className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4 text-left transition hover:border-[#ffdb57] hover:bg-[#fff8dd]"
              >
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Confirmed</p>
                <div className="mt-2 space-y-1 text-[14px] font-black text-[#2b211f]">
                  {getConfirmHistory(selectedReservation).length > 0 ? (
                    getConfirmHistory(selectedReservation).map((item, index) => (
                      <p key={`${item}-${index}`}>{item}</p>
                    ))
                  ) : (
                    <p>Not yet</p>
                  )}
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#8a746f]">
                  Press to add contact time
                </p>
              </button>
              <div className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4">
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Event</p>
                <p className="mt-2 text-[15px] font-black">{displayEvent.title}</p>
              </div>
              <div className="rounded-[18px] border border-[#ead6ce] bg-white/75 p-4 sm:col-span-2">
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8f3f38] sm:text-[9px]">Notes</p>
                <p className="mt-2 text-[15px] font-bold text-[#5a302b]">{selectedReservation.notes}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8f3f38]">
                  History
                </span>
                <span className="text-[13px] font-black text-[#2b211f]">
                  15 bookings
                </span>
                <span className="rounded-full bg-[#ffe1df] px-3 py-1.5 text-[12px] font-black text-[#9a4038]">
                  3 No Show
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {eventEditOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b211f]/40 px-4 backdrop-blur-sm"
          onClick={() => setEventEditOpen(false)}
        >
          <section
            className="w-full max-w-[660px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff8f3] text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
              <div>
                <h3 className="text-[22px] font-black tracking-[-0.04em]">
                  Edit event
                </h3>
                <p className="mt-1 text-[12px] font-bold text-[#8a746f]">
                  Update the event details shown on the reservation page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEventEditOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                aria-label="Close edit event popup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-[1fr_auto]">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Event name</span>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(event) => setEventTitle(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Event title"
                />
              </label>
              <button
                type="button"
                onClick={() => setEventFavorite((current) => !current)}
                className={`mt-6 grid h-12 w-12 place-items-center rounded-[16px] border transition ${eventFavorite ? "border-[#ffdb57] bg-[#ffdb57] text-[#2b211f]" : "border-[#ead6ce] bg-white text-[#8f3f38] hover:bg-[#fff8dd]"}`}
                aria-label="Set as favorite event"
              >
                <Star size={20} fill={eventFavorite ? "currentColor" : "none"} />
              </button>
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Description</span>
                <input
                  type="text"
                  value={eventDescription}
                  onChange={(event) => setEventDescription(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Short event description"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Date</span>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Time</span>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(event) => setEventTime(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Guests</span>
                <input
                  type="number"
                  min={0}
                  value={eventGuests}
                  onChange={(event) => setEventGuests(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Tables</span>
                <input
                  type="text"
                  value={eventTables}
                  onChange={(event) => setEventTables(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="8/20"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Entry</span>
                <input
                  type="text"
                  value={eventEntry}
                  onChange={(event) => setEventEntry(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Free entry or reservation only"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#eadbd6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setDeleteEventOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-[#f2bcb4] bg-[#ffe0dc] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#9a332b] transition hover:scale-[1.02]"
              >
                <Trash2 size={15} />
                Delete event
              </button>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEventEditOpen(false)}
                  className="rounded-[16px] border border-[#ead6ce] bg-white px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#5a302b] transition hover:bg-[#fff8dd]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setEventEditOpen(false)}
                  className="rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02]"
                >
                  Save event
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}


      {quickReservationOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b211f]/40 px-4 backdrop-blur-sm"
          onClick={() => setQuickReservationOpen(false)}
        >
          <section
            className="w-full max-w-[620px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff8f3] text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
              <div>
                <h3 className="text-[22px] font-black tracking-[-0.04em]">Event reservation</h3>
                <p className="mt-1 text-[12px] font-bold text-[#8a746f]">
                  {displayEvent.title} · {displayEvent.dayLabel} {displayEvent.dateLabel} · {displayEvent.timeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickReservationOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                aria-label="Close reservation popup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Phone</span>
                <input
                  type="tel"
                  value={quickReservationPhone}
                  onChange={(event) => setQuickReservationPhone(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Phone number"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Full name</span>
                <input
                  type="text"
                  value={quickReservationName}
                  onChange={(event) => setQuickReservationName(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Customer name"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Guests</span>
                <input
                  type="number"
                  min={1}
                  value={quickReservationGuests}
                  onChange={(event) => setQuickReservationGuests(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Table</span>
                <input
                  type="text"
                  value={quickReservationTable}
                  onChange={(event) => setQuickReservationTable(event.target.value)}
                  className="mt-2 h-12 w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Indoor 12"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#8f3f38]">Notes</span>
                <textarea
                  value={quickReservationNotes}
                  onChange={(event) => setQuickReservationNotes(event.target.value)}
                  className="mt-2 min-h-[92px] w-full rounded-[16px] border border-[#ead6ce] bg-white px-4 py-3 text-[14px] font-black text-[#2b211f] outline-none transition focus:border-[#ffdb57]"
                  placeholder="Special requests or notes"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#eadbd6] px-6 py-5">
              <button
                type="button"
                onClick={() => setQuickReservationOpen(false)}
                className="rounded-[16px] border border-[#ead6ce] bg-white px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#5a302b] transition hover:bg-[#fff8dd]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setQuickReservationOpen(false)}
                className="rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20 transition hover:scale-[1.02]"
              >
                Save reservation
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteEventOpen ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[#2b211f]/50 px-4 backdrop-blur-sm"
          onClick={() => setDeleteEventOpen(false)}
        >
          <section
            className="w-full max-w-[460px] overflow-hidden rounded-[26px] border border-[#f2bcb4] bg-[#fff8f3] text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#eadbd6] px-6 py-5">
              <h3 className="text-[22px] font-black tracking-[-0.04em] text-[#9a332b]">Delete event?</h3>
              <p className="mt-2 text-[13px] font-bold leading-relaxed text-[#7a605a]">
                This will remove {displayEvent.title} and its reservation list from the event page. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => setDeleteEventOpen(false)}
                className="rounded-[16px] border border-[#ead6ce] bg-white px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#5a302b] transition hover:bg-[#fff8dd]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => router.push('/reservation')}
                className="rounded-[16px] bg-[#ffe0dc] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#9a332b] transition hover:scale-[1.02]"
              >
                Delete event
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {shareFallbackOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b211f]/40 px-4 backdrop-blur-sm"
          onClick={() => setShareFallbackOpen(false)}
        >
          <section
            className="w-full max-w-[420px] rounded-[24px] border border-[#ead6ce] bg-[#fff8f3] p-6 text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-black tracking-[-0.04em]">Share event</h3>
                <p className="mt-2 text-[13px] font-bold text-[#7a605a]">
                  Native file sharing is not available on this browser. You can download the CSV and share it manually.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShareFallbackOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                aria-label="Close share popup"
              >
                <X size={17} />
              </button>
            </div>

            {shareFileUrl ? (
              <a
                href={shareFileUrl}
                download={shareFileName}
                className="mt-5 inline-flex w-full items-center justify-center rounded-[16px] bg-[#ffdb57] px-5 py-3 text-[12px] font-black uppercase tracking-[0.1em] text-[#2b211f] shadow-lg shadow-[#d6a83f]/20"
              >
                Download CSV
              </a>
            ) : null}
          </section>
        </div>
      ) : null}

      {statusReservation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#2b211f]/40 px-4 backdrop-blur-sm"
          onClick={() => setStatusReservation(null)}
        >
          <section
            className="w-full max-w-[460px] overflow-hidden rounded-[28px] border border-[#ead6ce] bg-[#fff8f3] text-[#2b211f] shadow-2xl shadow-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eadbd6] px-6 py-5">
              <div>
                <h3 className="text-[24px] font-black tracking-[-0.04em]">
                  Change status
                </h3>
                <p className="mt-1 text-[12px] font-black uppercase tracking-[0.08em] text-[#8a746f]">
                  {statusReservation.fullName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusReservation(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#ead6ce] bg-white text-[#8f3f38] transition hover:bg-[#ffdb57]"
                aria-label="Close status popup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5">
              <button
                type="button"
                onClick={() => updateStatus(statusReservation.id, "Pending")}
                className="rounded-[18px] border border-[#f0d46b] bg-[#fff1b8] px-4 py-3 text-left text-[14px] font-black text-[#6f4a00] transition hover:scale-[1.01]"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => updateStatus(statusReservation.id, "Arrived")}
                className="flex items-center justify-between rounded-[18px] border border-[#bde9cf] bg-[#dff7ea] px-4 py-3 text-left text-[14px] font-black text-[#22633d] transition hover:scale-[1.01]"
              >
                Arrived
                <span>{formatNowDateTime()}</span>
              </button>
              <button
                type="button"
                onClick={() => updateStatus(statusReservation.id, "No Show", "Guest did not arrive")}
                className="rounded-[18px] border border-[#f2bcb4] bg-[#ffe0dc] px-4 py-3 text-left text-[14px] font-black text-[#9a332b] transition hover:scale-[1.01]"
              >
                No Show
              </button>
              <button
                type="button"
                onClick={() => updateStatus(statusReservation.id, "Cancelled", "Cancelled by guest")}
                className="rounded-[18px] border border-[#d6cbc5] bg-[#e8e3df] px-4 py-3 text-left text-[14px] font-black text-[#5f5551] transition hover:scale-[1.01]"
              >
                Cancelled
              </button>
              <button
                type="button"
                onClick={() => updateStatus(statusReservation.id, "Late", "Guest is late")}
                className="rounded-[18px] border border-[#f4d09f] bg-[#fff0d7] px-4 py-3 text-left text-[14px] font-black text-[#9d551f] transition hover:scale-[1.01]"
              >
                Late
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
