import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { MENU_CACHE_TAG } from "@/lib/public-menu";

// Chiamata dal pannello admin dopo ogni modifica al menu: la visita
// successiva a home e menu riceve già la versione nuova.
export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  // expire: 0 = niente versione vecchia servita nel frattempo.
  revalidateTag(MENU_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true });
}
