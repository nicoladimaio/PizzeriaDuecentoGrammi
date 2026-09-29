import type { ReservationSettings } from "@/types/reservation";

export const slotMinuteOptions = [15, 30] as const;

export const weekdayOptions = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Gio" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sab" },
  { key: 0, label: "Dom" },
];

export const defaultSettings: ReservationSettings = {
  openTime: "19:00",
  closeTime: "23:00",
  slotMinutes: 30,
  capacityPerSlot: 40,
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [],
  specialOpenings: [],
  weeklyDisabledSlots: {},
};

export const parseMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const isHalfHourTimeValue = (value: string) => {
  const minutes = parseMinutes(value);
  return Number.isFinite(minutes) && minutes % 30 === 0;
};

export const getServiceEndMinutes = (openTime: string, closeTime: string) => {
  const open = parseMinutes(openTime);
  const close = parseMinutes(closeTime);

  if (!Number.isFinite(open) || !Number.isFinite(close)) {
    return null;
  }

  if (open === close) {
    return null;
  }

  return close > open ? close : close + 24 * 60;
};

export const minutesToTime = (value: number) => {
  const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const halfHourTimeOptions = Array.from({ length: 48 }, (_, index) =>
  minutesToTime(index * 30),
);

export const normalizeSettings = (
  settings: ReservationSettings,
): ReservationSettings => ({
  ...settings,
  openTime: isHalfHourTimeValue(settings.openTime)
    ? settings.openTime
    : defaultSettings.openTime,
  closeTime: isHalfHourTimeValue(settings.closeTime)
    ? settings.closeTime
    : defaultSettings.closeTime,
  slotMinutes:
    typeof settings.slotMinutes === "number" &&
    Number.isFinite(settings.slotMinutes) &&
    settings.slotMinutes >= 5 &&
    settings.slotMinutes <= 180
      ? settings.slotMinutes
      : 30,
  capacityPerSlot:
    typeof settings.capacityPerSlot === "number" &&
    Number.isFinite(settings.capacityPerSlot) &&
    settings.capacityPerSlot > 0
      ? Math.round(settings.capacityPerSlot)
      : 40,
  workingDays: [...new Set(settings.workingDays)].sort((a, b) => a - b),
  holidays: [...new Set(settings.holidays)].sort(),
  specialOpenings: [...new Set(settings.specialOpenings)].sort(),
  weeklyDisabledSlots: Object.fromEntries(
    Object.entries(settings.weeklyDisabledSlots ?? {}).map(
      ([weekday, values]) => [
        weekday,
        [...new Set(Array.isArray(values) ? values : [])]
          .filter((value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value))
          .sort(),
      ],
    ),
  ),
});

export const getSlotTimesForWeekday = (
  _weekday: number,
  settings: ReservationSettings,
): string[] => {
  const open = parseMinutes(settings.openTime);
  const endMinutes = getServiceEndMinutes(
    settings.openTime,
    settings.closeTime,
  );
  const slotMinutes = settings.slotMinutes;

  if (!Number.isFinite(open) || endMinutes === null) {
    return ["20:00"];
  }

  const slots: string[] = [];
  for (let minute = open; minute <= endMinutes; minute += slotMinutes) {
    slots.push(minutesToTime(minute));
  }

  return slots.length > 0 ? slots : ["20:00"];
};

export const getSlotMinutesForDateKey = (
  _dateKey: string,
  settings: ReservationSettings,
): number => settings.slotMinutes;

export const isBookingOpenOnDateKey = (
  dateKey: string,
  settings: ReservationSettings,
): boolean => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const weekday = date.getDay();
  const isSpecialOpening = settings.specialOpenings.includes(dateKey);
  const isHoliday = settings.holidays.includes(dateKey);
  const isWorkingDay = settings.workingDays.includes(weekday);

  if (isSpecialOpening) {
    return true;
  }

  return isWorkingDay && !isHoliday;
};

export const buildSettingsSnapshot = (settings: ReservationSettings) =>
  JSON.stringify(normalizeSettings(settings));
