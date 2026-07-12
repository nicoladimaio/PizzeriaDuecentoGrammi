import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const manualReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  guests: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
});

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "proposed"]);

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

const buildCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "DG-";
  for (let i = 0; i < 6; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
};

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
    const parsed = manualReservationSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const code = buildCode();
    const reservationId = db.collection("reservations").doc().id;
    const normalizedEmail = (parsed.data.email ?? "").trim();
    const normalizedPhone = (parsed.data.phone ?? "").trim();
    const diningArea = "inside" as const;

    const settingsSnap = await db
      .collection("reservation_settings")
      .doc("default")
      .get();
    const settings = settingsSnap.data() as
      | {
          capacityPerSlot?: unknown;
          insideActive?: unknown;
          outsideActive?: unknown;
          insideCapacityPerSlot?: unknown;
          outsideCapacityPerSlot?: unknown;
        }
      | undefined;
    const insideActive =
      typeof settings?.insideActive === "boolean" ? settings.insideActive : true;
    const outsideActive =
      typeof settings?.outsideActive === "boolean"
        ? settings.outsideActive
        : true;
    const insideCapacityPerSlot =
      typeof settings?.insideCapacityPerSlot === "number" &&
      Number.isFinite(settings.insideCapacityPerSlot) &&
      settings.insideCapacityPerSlot > 0
        ? Math.round(settings.insideCapacityPerSlot)
        : Number(process.env.RESERVATION_CAPACITY_INSIDE_PER_SLOT ?? 40);
    const outsideCapacityPerSlot =
      typeof settings?.outsideCapacityPerSlot === "number" &&
      Number.isFinite(settings.outsideCapacityPerSlot) &&
      settings.outsideCapacityPerSlot > 0
        ? Math.round(settings.outsideCapacityPerSlot)
        : Number(process.env.RESERVATION_CAPACITY_OUTSIDE_PER_SLOT ?? 24);
    const capacityPerSlot =
      typeof settings?.capacityPerSlot === "number" &&
      Number.isFinite(settings.capacityPerSlot) &&
      settings.capacityPerSlot > 0
        ? Math.round(settings.capacityPerSlot)
        : Number(process.env.RESERVATION_CAPACITY_PER_SLOT ?? 40);
    const totalCapacity =
      (insideActive ? insideCapacityPerSlot : 0) +
      (outsideActive ? outsideCapacityPerSlot : 0) ||
      capacityPerSlot;

    const occupancySnap = await db
      .collection("reservations")
      .where("date", "==", parsed.data.date)
      .where("time", "==", parsed.data.time)
      .get();

    const reservedSeats = occupancySnap.docs.reduce((sum, doc) => {
      const data = doc.data() as {
        guests?: number;
        status?: string;
      };

      if (!ACTIVE_STATUSES.has(data.status ?? "")) return sum;

      return sum + (typeof data.guests === "number" ? data.guests : 0);
    }, 0);

    if (reservedSeats + parsed.data.guests > totalCapacity) {
      return NextResponse.json(
        {
          error: "Capienza superata per questa fascia oraria.",
        },
        { status: 400 },
      );
    }

    const reservationDoc = {
      customerName: parsed.data.customerName,
      phone: normalizedPhone,
      email: normalizedEmail,
      diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      notes: parsed.data.notes ?? "",
      code,
      status: "confirmed",
      arrived: false,
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
      createdManually: true,
    };

    await db.collection("reservations").doc(reservationId).set(reservationDoc);

    await db.collection("reservation_status").doc(code).set({
      reservationId,
      code,
      customerName: parsed.data.customerName,
      phone: normalizedPhone,
      email: normalizedEmail,
      diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      status: "confirmed",
      arrived: false,
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, code });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/manual", error);
    return NextResponse.json(
      { error: "Impossibile creare la prenotazione manuale." },
      { status: 500 },
    );
  }
}
