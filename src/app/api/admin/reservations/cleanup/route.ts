import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

const HISTORY_RETENTION_DAYS = 14;

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

const toDateKey = (date: Date): string => {
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

    const db = getAdminDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const retentionCutoffKey = toDateKey(
      addDays(today, -(HISTORY_RETENTION_DAYS + 1)),
    );

    const oldReservations = await db
      .collection("reservations")
      .where("date", "<=", retentionCutoffKey)
      .get();

    if (oldReservations.empty) {
      return NextResponse.json({ ok: true, deletedCount: 0 });
    }

    const batch = db.batch();
    let deletedCount = 0;

    for (const doc of oldReservations.docs) {
      const data = doc.data() as { code?: string };

      batch.delete(doc.ref);
      deletedCount += 1;

      if (data.code) {
        const statusRef = db.collection("reservation_status").doc(data.code);
        batch.delete(statusRef);
      }
    }

    await batch.commit();

    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/cleanup", error);
    return NextResponse.json(
      { error: "Impossibile eliminare le prenotazioni vecchie." },
      { status: 500 },
    );
  }
}
