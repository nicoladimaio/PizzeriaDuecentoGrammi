import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { SETTINGS_CACHE_TAG } from "@/lib/restaurant-info";

const slotMinutesSchema = z.number().int().min(5).max(180);
const timeValueSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const settingsSchema = z.object({
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slotMinutes: slotMinutesSchema,
  capacityPerSlot: z.number().int().min(1).max(500),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(80),
  specialOpenings: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(80),
  weeklyDisabledSlots: z.record(z.string(), z.array(timeValueSchema).max(80)),
});

const parseMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const isHalfHourTimeValue = (value: string): boolean =>
  parseMinutes(value) % 30 === 0;

const getServiceEndMinutes = (openTime: string, closeTime: string): number | null => {
  const open = parseMinutes(openTime);
  const close = parseMinutes(closeTime);

  if (open === close) {
    return null;
  }

  return close > open ? close : close + 24 * 60;
};

const defaultSettings = () => ({
  openTime: process.env.RESERVATION_OPEN_TIME ?? "19:00",
  closeTime: process.env.RESERVATION_CLOSE_TIME ?? "23:00",
  slotMinutes: 30,
  capacityPerSlot: Number(process.env.RESERVATION_CAPACITY_PER_SLOT ?? 40),
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [] as string[],
  specialOpenings: [] as string[],
  weeklyDisabledSlots: {} as Record<string, string[]>,
});

export async function GET(request: Request) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    const ref = db.collection("reservation_settings").doc("default");
    const snap = await ref.get();
    const fallback = defaultSettings();

    const merged = {
      ...fallback,
      ...(snap.exists ? snap.data() : {}),
    };

    const parsed = settingsSchema.safeParse(merged);
    if (!parsed.success) {
      return NextResponse.json({ settings: fallback });
    }

    return NextResponse.json({ settings: parsed.data });
  } catch (error) {
    console.error("Errore GET /api/admin/reservations/settings", error);
    return NextResponse.json(
      { error: "Impossibile recuperare impostazioni prenotazioni." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const payload = (await request.json()) as unknown;
    const parsed = settingsSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Dati impostazioni non validi.",
        },
        { status: 400 },
      );
    }

    if (
      !isHalfHourTimeValue(parsed.data.openTime) ||
      !isHalfHourTimeValue(parsed.data.closeTime)
    ) {
      return NextResponse.json(
        {
          error:
            "Orario apertura e chiusura devono essere impostati a intervalli di 30 minuti.",
        },
        { status: 400 },
      );
    }

    const serviceEnd = getServiceEndMinutes(
      parsed.data.openTime,
      parsed.data.closeTime,
    );
    if (!serviceEnd) {
      return NextResponse.json(
        {
          error:
            "Orario apertura e chiusura non possono coincidere. Se il servizio termina dopo mezzanotte, imposta l'orario del giorno successivo.",
        },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    await db
      .collection("reservation_settings")
      .doc("default")
      .set(
        {
          ...parsed.data,
          // Campi della vecchia divisione sala interna/esterna, non più usati.
          insideActive: FieldValue.delete(),
          outsideActive: FieldValue.delete(),
          insideCapacityPerSlot: FieldValue.delete(),
          outsideCapacityPerSlot: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    // Orari nel footer della home e dati per Google: subito aggiornati.
    revalidateTag(SETTINGS_CACHE_TAG, { expire: 0 });

    return NextResponse.json({ ok: true, settings: parsed.data });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/settings", error);
    return NextResponse.json(
      { error: "Impossibile salvare impostazioni prenotazioni." },
      { status: 500 },
    );
  }
}
