import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const manualReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(3),
  email: z.string().trim().email().optional().or(z.literal("")),
  diningArea: z.enum(["inside", "outside"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  guests: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
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

    const reservationDoc = {
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      email: normalizedEmail,
      diningArea: parsed.data.diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      notes: parsed.data.notes ?? "",
      code,
      status: "pending",
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
      phone: parsed.data.phone,
      email: normalizedEmail,
      diningArea: parsed.data.diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      status: "pending",
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
