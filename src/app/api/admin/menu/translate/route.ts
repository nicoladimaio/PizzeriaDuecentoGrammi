import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  CONTENT_LOCALES,
  hashCategorySource,
  hashMenuItemSource,
  readCategorySource,
  readCategoryTranslation,
  readMenuItemSource,
  readMenuItemTranslation,
} from "@/lib/menu-translations";
import {
  isMenuTranslatorConfigured,
  MenuTranslationRefusedError,
  translateMenuBatch,
} from "@/lib/menu-translator";

// Ogni chiamata traduce un blocco limitato, cosi resta sotto il timeout delle
// funzioni serverless: il pannello admin richiama finche remaining = 0.
const ITEMS_PER_CALL = 12;
const CATEGORIES_PER_CALL = 30;

export const maxDuration = 60;

const requestSchema = z.object({
  locale: z.enum(CONTENT_LOCALES),
  /** Piatti da ritradurre anche se hanno gia una traduzione valida. */
  forceItemIds: z.array(z.string()).max(ITEMS_PER_CALL).optional(),
});

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  if (!isMenuTranslatorConfigured()) {
    return NextResponse.json(
      { error: "Traduzione automatica non configurata: manca ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const { locale, forceItemIds = [] } = parsed.data;
  const forced = new Set(forceItemIds);

  try {
    const db = getAdminDb();
    const [itemsSnap, categoriesSnap] = await Promise.all([
      db.collection("menu_items").get(),
      db.collection("menu_categories").get(),
    ]);

    // Da tradurre: senza traduzione, oppure con l'italiano cambiato nel frattempo.
    const pendingItems = itemsSnap.docs
      .map((doc) => {
        const raw = doc.data() as Record<string, unknown>;
        const source = readMenuItemSource(raw);
        const existing = readMenuItemTranslation(raw, locale);
        const sourceHash = hashMenuItemSource(source);
        const needsWork =
          forced.has(doc.id) || !existing || existing.sourceHash !== sourceHash;
        return { ref: doc.ref, id: doc.id, source, sourceHash, needsWork };
      })
      .filter((entry) => entry.source.nome && entry.needsWork);

    const pendingCategories = categoriesSnap.docs
      .map((doc) => {
        const raw = doc.data() as Record<string, unknown>;
        const source = readCategorySource(raw);
        const existing = readCategoryTranslation(raw, locale);
        const sourceHash = hashCategorySource(source);
        return {
          ref: doc.ref,
          id: doc.id,
          source,
          sourceHash,
          needsWork: !existing || existing.sourceHash !== sourceHash,
        };
      })
      .filter((entry) => entry.source.nome && entry.needsWork);

    // I piatti forzati per primi.
    pendingItems.sort(
      (a, b) => Number(forced.has(b.id)) - Number(forced.has(a.id)),
    );
    const itemBatch = pendingItems.slice(0, ITEMS_PER_CALL);
    const categoryBatch = pendingCategories.slice(0, CATEGORIES_PER_CALL);

    if (itemBatch.length === 0 && categoryBatch.length === 0) {
      return NextResponse.json({
        ok: true,
        translatedItems: 0,
        translatedCategories: 0,
        remainingItems: 0,
        remainingCategories: 0,
      });
    }

    const result = await translateMenuBatch(
      locale,
      itemBatch.map((entry) => ({ id: entry.id, ...entry.source })),
      categoryBatch.map((entry) => ({ id: entry.id, ...entry.source })),
    );

    const nowIso = new Date().toISOString();
    const batch = db.batch();
    let translatedItems = 0;
    let translatedCategories = 0;

    for (const entry of itemBatch) {
      const translation = result.items.find((item) => item.id === entry.id);
      if (!translation?.nome.trim()) continue;
      batch.update(entry.ref, {
        [`i18n.${locale}`]: {
          nome: translation.nome.trim(),
          descrizione: translation.descrizione.trim(),
          ingredienti: translation.ingredienti.trim(),
          status: "auto",
          sourceHash: entry.sourceHash,
          updatedAt: nowIso,
        },
      });
      translatedItems += 1;
    }

    for (const entry of categoryBatch) {
      const translation = result.categories.find(
        (category) => category.id === entry.id,
      );
      if (!translation?.nome.trim()) continue;
      batch.update(entry.ref, {
        [`i18n.${locale}`]: {
          nome: translation.nome.trim(),
          status: "auto",
          sourceHash: entry.sourceHash,
          updatedAt: nowIso,
        },
      });
      translatedCategories += 1;
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      translatedItems,
      translatedCategories,
      remainingItems: Math.max(pendingItems.length - translatedItems, 0),
      remainingCategories: Math.max(
        pendingCategories.length - translatedCategories,
        0,
      ),
    });
  } catch (error) {
    console.error("Errore POST /api/admin/menu/translate", error);
    const message =
      error instanceof MenuTranslationRefusedError
        ? `Traduzione rifiutata: ${error.message}`
        : "Traduzione automatica non riuscita. Riprova tra poco.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
