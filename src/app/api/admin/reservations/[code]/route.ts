import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
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

    const { code } = await context.params;
    const db = getAdminDb();

    const reservationQuery = await db
      .collection("reservations")
      .where("code", "==", code)
      .limit(1)
      .get();

    const statusRef = db.collection("reservation_status").doc(code);
    const batch = db.batch();

    if (!reservationQuery.empty) {
      batch.delete(reservationQuery.docs[0].ref);
    }

    const statusSnapshot = await statusRef.get();
    if (statusSnapshot.exists) {
      batch.delete(statusRef);
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Errore DELETE /api/admin/reservations/[code]", error);
    return NextResponse.json(
      { error: "Impossibile eliminare la prenotazione." },
      { status: 500 },
    );
  }
}
