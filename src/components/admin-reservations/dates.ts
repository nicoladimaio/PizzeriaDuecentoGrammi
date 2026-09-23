import type { CalendarCell } from "@/components/admin-reservations/types";

export const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dateKeyDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dateKeyDaysAhead = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const monthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
};

export const startOfMonthFromKey = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
};

export const endOfMonthFromKey = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month || 1, 0);
};

export const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
};

export const formatDateShort = (value: string) => {
  const parsed = parseDateKey(value);
  return parsed.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

export const getOperationalDayLabel = (value: string) => {
  if (value === dateKeyDaysAgo(1)) return "Ieri";
  if (value === todayKey()) return "Oggi";
  if (value === dateKeyDaysAhead(1)) return "Domani";

  const parsed = parseDateKey(value);
  return `${parsed.getDate()} ${parsed
    .toLocaleDateString("it-IT", {
      month: "short",
    })
    .replace(".", "")}`;
};

export const buildMonthCells = (value: string): CalendarCell[] => {
  const [year, month] = value.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstWeekday = (first.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ kind: "empty" });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ kind: "day", dateKey: key, day });
  }

  return cells;
};
