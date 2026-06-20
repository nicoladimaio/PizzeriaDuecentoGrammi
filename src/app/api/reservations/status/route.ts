import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";

const querySchema = z.object({
  email: z.string().trim().email(),
});

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Inserisci una email valida." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const db = getAdminDb();
    const snapshot = await db
      .collection("reservation_status")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Nessuna prenotazione trovata con questa email." },
        { status: 404 },
      );
    }

    const rows = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as Record<string, unknown>;
      return {
        customerName:
          typeof data.customerName === "string" ? data.customerName : "",
        date: typeof data.date === "string" ? data.date : "",
        time: typeof data.time === "string" ? data.time : "",
        guests: typeof data.guests === "number" ? data.guests : 0,
        status:
          data.status === "pending" ||
          data.status === "confirmed" ||
          data.status === "rejected" ||
          data.status === "proposed"
            ? data.status
            : "pending",
        ownerResponse:
          typeof data.ownerResponse === "string" ? data.ownerResponse : "",
        proposedDate:
          typeof data.proposedDate === "string" ? data.proposedDate : "",
        proposedTime:
          typeof data.proposedTime === "string" ? data.proposedTime : "",
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
      };
    });

    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return NextResponse.json({ result: rows[0] });
  } catch (error) {
    console.error("Errore GET /api/reservations/status", error);
    return NextResponse.json(
      { error: "Impossibile recuperare lo stato in questo momento." },
      { status: 500 },
    );
  }
}
