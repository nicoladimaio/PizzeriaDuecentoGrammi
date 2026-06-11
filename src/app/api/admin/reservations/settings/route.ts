import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const settingsSchema = z.object({
  openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  slotMinutes: z.literal(30),
  capacityPerSlot: z.number().int().min(1).max(500),
  insideActive: z.boolean(),
  outsideActive: z.boolean(),
  insideCapacityPerSlot: z.number().int().min(1).max(500),
  outsideCapacityPerSlot: z.number().int().min(1).max(500),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(80),
  specialOpenings: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(80),
});

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
};

const isAllowedAdminEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  const whitelist = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return whitelist.includes(email.toLowerCase());
};

const parseMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const defaultSettings = () => ({
  openTime: process.env.RESERVATION_OPEN_TIME ?? "19:00",
  closeTime: process.env.RESERVATION_CLOSE_TIME ?? "23:00",
  slotMinutes: 30 as const,
  capacityPerSlot: Number(process.env.RESERVATION_CAPACITY_PER_SLOT ?? 40),
  insideActive: true,
  outsideActive: true,
  insideCapacityPerSlot: Number(
    process.env.RESERVATION_CAPACITY_INSIDE_PER_SLOT ?? 40,
  ),
  outsideCapacityPerSlot: Number(
    process.env.RESERVATION_CAPACITY_OUTSIDE_PER_SLOT ?? 24,
  ),
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [] as string[],
  specialOpenings: [] as string[],
});

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    if (!isAllowedAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Accesso negato." }, { status: 403 });
    }

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
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    if (!isAllowedAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Accesso negato." }, { status: 403 });
    }

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

    const open = parseMinutes(parsed.data.openTime);
    const close = parseMinutes(parsed.data.closeTime);
    if (close <= open) {
      return NextResponse.json(
        { error: "L'orario di chiusura deve essere successivo all'apertura." },
        { status: 400 },
      );
    }

    if (!parsed.data.insideActive && !parsed.data.outsideActive) {
      return NextResponse.json(
        { error: "Attiva almeno una sala tra interno ed esterno." },
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
          slotMinutes: 30,
          updatedAt: new Date().toISOString(),
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return NextResponse.json({ ok: true, settings: parsed.data });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/settings", error);
    return NextResponse.json(
      { error: "Impossibile salvare impostazioni prenotazioni." },
      { status: 500 },
    );
  }
}
