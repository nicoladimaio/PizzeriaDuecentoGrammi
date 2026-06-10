import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";

const querySchema = z.object({
  guests: z.coerce.number().int().min(1).max(20),
  room: z.enum(["inside", "outside"]).optional(),
});

const MAX_DAYS = 31;
const ACTIVE_STATUSES = new Set(["pending", "confirmed", "proposed"]);

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const parseMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value: number): string => {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getSlotSettings = () => {
  const openTime = process.env.RESERVATION_OPEN_TIME ?? "19:00";
  const closeTime = process.env.RESERVATION_CLOSE_TIME ?? "23:00";
  const slotMinutes = Number(process.env.RESERVATION_SLOT_MINUTES ?? 30);
  const capacityPerSlot = Number(
    process.env.RESERVATION_CAPACITY_PER_SLOT ?? 40,
  );
  const insideCapacityPerSlot = Number(
    process.env.RESERVATION_CAPACITY_INSIDE_PER_SLOT ?? capacityPerSlot,
  );
  const outsideCapacityPerSlot = Number(
    process.env.RESERVATION_CAPACITY_OUTSIDE_PER_SLOT ?? 24,
  );

  const openMinutes = parseMinutes(openTime);
  const closeMinutes = parseMinutes(closeTime);

  const safeSlot =
    Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30;
  const safeCapacity =
    Number.isFinite(capacityPerSlot) && capacityPerSlot > 0
      ? capacityPerSlot
      : 40;

  return {
    openTime,
    closeTime,
    slotMinutes: safeSlot,
    capacityPerSlot: safeCapacity,
    insideCapacityPerSlot:
      Number.isFinite(insideCapacityPerSlot) && insideCapacityPerSlot > 0
        ? Math.round(insideCapacityPerSlot)
        : safeCapacity,
    outsideCapacityPerSlot:
      Number.isFinite(outsideCapacityPerSlot) && outsideCapacityPerSlot > 0
        ? Math.round(outsideCapacityPerSlot)
        : 24,
    openMinutes,
    closeMinutes,
  };
};

const asDateKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
};

const uniqueWeekdays = (source: unknown): number[] => {
  if (!Array.isArray(source)) return [1, 2, 3, 4, 5, 6, 0];
  const values = source
    .filter((value): value is number => Number.isInteger(value))
    .filter((value) => value >= 0 && value <= 6);
  return [...new Set(values)];
};

const resolveSlotSettings = async (db: ReturnType<typeof getAdminDb>) => {
  const envSettings = getSlotSettings();
  const defaultWorkingDays = [1, 2, 3, 4, 5, 6, 0];

  try {
    const settingsSnap = await db
      .collection("reservation_settings")
      .doc("default")
      .get();
    const data = settingsSnap.data() as
      | {
          openTime?: unknown;
          closeTime?: unknown;
          slotMinutes?: unknown;
          capacityPerSlot?: unknown;
          insideActive?: unknown;
          outsideActive?: unknown;
          insideCapacityPerSlot?: unknown;
          outsideCapacityPerSlot?: unknown;
          workingDays?: unknown;
          holidays?: unknown;
          specialOpenings?: unknown;
        }
      | undefined;

    const openTime =
      typeof data?.openTime === "string" &&
      /^([01]\d|2[0-3]):([0-5]\d)$/.test(data.openTime)
        ? data.openTime
        : envSettings.openTime;

    const closeTime =
      typeof data?.closeTime === "string" &&
      /^([01]\d|2[0-3]):([0-5]\d)$/.test(data.closeTime)
        ? data.closeTime
        : envSettings.closeTime;

    const slotMinutes =
      data?.slotMinutes === 15 || data?.slotMinutes === 30
        ? data.slotMinutes
        : envSettings.slotMinutes === 15
          ? 15
          : 30;

    const capacityPerSlot =
      typeof data?.capacityPerSlot === "number" &&
      Number.isFinite(data.capacityPerSlot) &&
      data.capacityPerSlot > 0
        ? Math.round(data.capacityPerSlot)
        : envSettings.capacityPerSlot;

    const insideActive =
      typeof data?.insideActive === "boolean" ? data.insideActive : true;
    const outsideActive =
      typeof data?.outsideActive === "boolean" ? data.outsideActive : true;
    const insideCapacityPerSlot =
      typeof data?.insideCapacityPerSlot === "number" &&
      Number.isFinite(data.insideCapacityPerSlot) &&
      data.insideCapacityPerSlot > 0
        ? Math.round(data.insideCapacityPerSlot)
        : envSettings.insideCapacityPerSlot;
    const outsideCapacityPerSlot =
      typeof data?.outsideCapacityPerSlot === "number" &&
      Number.isFinite(data.outsideCapacityPerSlot) &&
      data.outsideCapacityPerSlot > 0
        ? Math.round(data.outsideCapacityPerSlot)
        : envSettings.outsideCapacityPerSlot;

    const workingDays = uniqueWeekdays(data?.workingDays);
    const holidays = Array.isArray(data?.holidays)
      ? data.holidays
          .map(asDateKey)
          .filter((value): value is string => Boolean(value))
      : [];
    const specialOpenings = Array.isArray(data?.specialOpenings)
      ? data.specialOpenings
          .map(asDateKey)
          .filter((value): value is string => Boolean(value))
      : [];

    return {
      ...envSettings,
      openTime,
      closeTime,
      slotMinutes,
      capacityPerSlot,
      insideActive,
      outsideActive,
      insideCapacityPerSlot,
      outsideCapacityPerSlot,
      openMinutes: parseMinutes(openTime),
      closeMinutes: parseMinutes(closeTime),
      workingDays: workingDays.length > 0 ? workingDays : defaultWorkingDays,
      holidays: new Set(holidays),
      specialOpenings: new Set(specialOpenings),
    };
  } catch {
    return {
      ...envSettings,
      slotMinutes: envSettings.slotMinutes === 15 ? 15 : 30,
      capacityPerSlot: envSettings.capacityPerSlot,
      insideActive: true,
      outsideActive: true,
      insideCapacityPerSlot: envSettings.insideCapacityPerSlot,
      outsideCapacityPerSlot: envSettings.outsideCapacityPerSlot,
      workingDays: defaultWorkingDays,
      holidays: new Set<string>(),
      specialOpenings: new Set<string>(),
    };
  }
};

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Numero persone non valido." },
        { status: 400 },
      );
    }

    const { guests, room } = parsed.data;
    const db = getAdminDb();
    const settings = await resolveSlotSettings(db);

    const activeRoom: "inside" | "outside" = room
      ? room
      : settings.insideActive && !settings.outsideActive
        ? "inside"
        : settings.outsideActive && !settings.insideActive
          ? "outside"
          : "inside";

    const roomEnabled =
      activeRoom === "inside" ? settings.insideActive : settings.outsideActive;
    const roomCapacity =
      activeRoom === "inside"
        ? settings.insideCapacityPerSlot
        : settings.outsideCapacityPerSlot;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const sameDayClosedAfterOpen = nowMinutes >= settings.openMinutes;

    const endDate = addDays(today, MAX_DAYS - 1);
    const startKey = toLocalDateKey(today);
    const endKey = toLocalDateKey(endDate);

    const reservationSnapshot = await db
      .collection("reservations")
      .where("date", ">=", startKey)
      .where("date", "<=", endKey)
      .get();

    const occupancy = new Map<string, number>();

    for (const doc of reservationSnapshot.docs) {
      const data = doc.data() as {
        date?: string;
        time?: string;
        guests?: number;
        status?: string;
        diningArea?: "inside" | "outside";
      };

      if (!data.date || !data.time || !data.guests || !data.status) continue;
      if (!ACTIVE_STATUSES.has(data.status)) continue;

      const area = data.diningArea === "outside" ? "outside" : "inside";
      const key = `${data.date}|${data.time}|${area}`;
      occupancy.set(key, (occupancy.get(key) ?? 0) + data.guests);
    }

    const slotTimes: string[] = [];
    for (
      let minute = settings.openMinutes;
      minute <= settings.closeMinutes;
      minute += settings.slotMinutes
    ) {
      slotTimes.push(minutesToTime(minute));
    }

    const days: Array<{
      date: string;
      hasAvailability: boolean;
      availableSlots: number;
    }> = [];

    const slotsByDate: Record<
      string,
      Array<{ time: string; available: boolean; remainingSeats: number }>
    > = {};

    for (let i = 0; i < MAX_DAYS; i += 1) {
      const dayDate = addDays(today, i);
      const date = toLocalDateKey(dayDate);
      const weekDay = dayDate.getDay();
      const isClosedByRules =
        !settings.workingDays.includes(weekDay) || settings.holidays.has(date);
      const isClosedBySameDayCutoff = i === 0 && sameDayClosedAfterOpen;
      const isClosedDay =
        (isClosedByRules && !settings.specialOpenings.has(date)) ||
        isClosedBySameDayCutoff;

      const slots = isClosedDay
        ? slotTimes.map((time) => ({
            time,
            available: false,
            remainingSeats: 0,
          }))
        : !roomEnabled
          ? slotTimes.map((time) => ({
              time,
              available: false,
              remainingSeats: 0,
            }))
          : slotTimes.map((time) => {
              const reserved =
                occupancy.get(`${date}|${time}|${activeRoom}`) ?? 0;
              const remainingSeats = Math.max(roomCapacity - reserved, 0);
              return {
                time,
                available: remainingSeats >= guests,
                remainingSeats,
              };
            });

      const availableSlots = slots.filter((slot) => slot.available).length;

      slotsByDate[date] = slots;
      days.push({
        date,
        hasAvailability: availableSlots > 0,
        availableSlots,
      });
    }

    return NextResponse.json({
      days,
      slotsByDate,
      config: {
        maxDays: MAX_DAYS,
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        slotMinutes: settings.slotMinutes,
        capacityPerSlot: settings.capacityPerSlot,
        activeRoom,
        insideActive: settings.insideActive,
        outsideActive: settings.outsideActive,
        insideCapacityPerSlot: settings.insideCapacityPerSlot,
        outsideCapacityPerSlot: settings.outsideCapacityPerSlot,
        workingDays: settings.workingDays,
        sameDayClosedAfterOpen,
      },
    });
  } catch (error) {
    console.error("Errore GET /api/reservations/availability", error);
    return NextResponse.json(
      { error: "Impossibile recuperare disponibilita al momento." },
      { status: 500 },
    );
  }
}
