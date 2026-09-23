import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import { isAllowedAdminEmail } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebase-admin";

type AdminCheck =
  | { ok: true; admin: DecodedIdToken }
  | { ok: false; response: NextResponse };

/**
 * Verifica il token Firebase inviato come `Authorization: Bearer <token>`
 * e che l'email sia nella whitelist admin.
 */
export const requireAdmin = async (request: Request): Promise<AdminCheck> => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorizzato." }, { status: 401 }),
    };
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifyIdToken(
      authHeader.slice("Bearer ".length),
    );
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sessione scaduta o non valida." },
        { status: 401 },
      ),
    };
  }

  if (!isAllowedAdminEmail(decoded.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Accesso negato." }, { status: 403 }),
    };
  }

  return { ok: true, admin: decoded };
};
