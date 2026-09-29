import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  ACTIVE_RESERVATION_STATUSES,
  MAX_BOOKING_DAYS,
  getSlotTimes,
  isDayClosed,
  isSameDayClosed,
  isSlotDisabled,
  resolveReservationSettings,
} from "@/lib/reservation-availability";
import { addDaysToDateKey, getRomeNow } from "@/lib/rome-time";

const querySchema = z.object({
  guests: z.coerce.number().int().min(1).max(20),
});

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

    const { guests } = parsed.data;
    const db = getAdminDb();
    const settings = await resolveReservationSettings(db);
    const totalCapacity = settings.capacityPerSlot;
    const slotTimes = getSlotTimes(settings);

    const romeNow = getRomeNow();
    const sameDayClosedAfterOpen = isSameDayClosed(settings, romeNow);

    const startKey = romeNow.dateKey;
    const endKey = addDaysToDateKey(startKey, MAX_BOOKING_DAYS - 1);

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
      };

      if (!data.date || !data.time || !data.guests || !data.status) continue;
      if (!ACTIVE_RESERVATION_STATUSES.has(data.status)) continue;

      const key = `${data.date}|${data.time}`;
      occupancy.set(key, (occupancy.get(key) ?? 0) + data.guests);
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

    for (let i = 0; i < MAX_BOOKING_DAYS; i += 1) {
      const date = addDaysToDateKey(startKey, i);

      const slots = isDayClosed(date, settings, romeNow)
        ? slotTimes.map((time) => ({
            time,
            available: false,
            remainingSeats: 0,
          }))
        : slotTimes.map((time) => {
            const reserved = occupancy.get(`${date}|${time}`) ?? 0;
            const remainingSeats = Math.max(totalCapacity - reserved, 0);
            return {
              time,
              available:
                !isSlotDisabled(date, time, settings) &&
                remainingSeats >= guests,
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
        maxDays: MAX_BOOKING_DAYS,
        openTime: settings.openTime,
        closeTime: settings.closeTime,
        slotMinutes: settings.slotMinutes,
        capacityPerSlot: settings.capacityPerSlot,
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
