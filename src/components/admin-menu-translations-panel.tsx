"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { getClientAuth } from "@/lib/firebase-auth";
import { createMenuChangeWatcher } from "@/components/admin-menu/menu-cache";
import {
  CONTENT_LOCALES,
  hashCategorySource,
  hashMenuItemSource,
  readCategorySource,
  readCategoryTranslation,
  readMenuItemSource,
  readMenuItemTranslation,
  type ContentLocale,
  type MenuItemSource,
} from "@/lib/menu-translations";

type TranslationState = "missing" | "outdated" | "auto" | "reviewed";

type ItemRow = {
  id: string;
  category: string;
  source: MenuItemSource;
  translated: MenuItemSource | null;
  state: TranslationState;
};

type CategoryRow = {
  id: string;
  source: string;
  translated: string;
  state: TranslationState;
};

type Filter = "todo" | "all";

const LOCALE_LABELS: Record<ContentLocale, string> = {
  en: "Inglese",
  es: "Spagnolo",
  de: "Tedesco",
};

const STATE_LABELS: Record<TranslationState, string> = {
  missing: "Da tradurre",
  outdated: "Italiano modificato: da ritradurre",
  auto: "Automatica, da rivedere",
  reviewed: "Rivista",
};

const resolveState = (
  translation: { status: string; sourceHash: string } | null,
  currentHash: string,
): TranslationState => {
  if (!translation) return "missing";
  if (translation.sourceHash !== currentHash) return "outdated";
  return translation.status === "reviewed" ? "reviewed" : "auto";
};

const getAdminToken = async (): Promise<string> => {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Sessione scaduta: effettua di nuovo l'accesso.");
  return user.getIdToken();
};

type TranslateResponse = {
  ok?: boolean;
  error?: string;
  translatedItems?: number;
  translatedCategories?: number;
  remainingItems?: number;
  remainingCategories?: number;
};

const callTranslateApi = async (
  locale: ContentLocale,
  forceItemIds?: string[],
): Promise<TranslateResponse> => {
  const response = await fetch("/api/admin/menu/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getAdminToken()}`,
    },
    body: JSON.stringify({ locale, forceItemIds }),
  });
  const data = (await response.json().catch(() => ({}))) as TranslateResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Errore traduzione (HTTP ${response.status}).`);
  }
  return data;
};

/**
 * Traduzioni (inglese, spagnolo, tedesco) di piatti e categorie: traduzione automatica di
 * cio che manca e revisione manuale voce per voce.
 */
export function AdminMenuTranslationsPanel() {
  const [locale, setLocale] = useState<ContentLocale>("en");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [drafts, setDrafts] = useState<Record<string, MenuItemSource>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(
    {},
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getClientDb();
    const watchItemChanges = createMenuChangeWatcher(db);
    const watchCategoryChanges = createMenuChangeWatcher(db);

    const unsubscribeItems = onSnapshot(collection(db, "menu_items"), (snap) => {
      watchItemChanges(snap);
      setItems(
        snap.docs
          .map((entry) => {
            const raw = entry.data() as Record<string, unknown>;
            const source = readMenuItemSource(raw);
            const translation = readMenuItemTranslation(raw, locale);
            return {
              id: entry.id,
              category: String(raw.categoria ?? raw.Categoria ?? "").trim(),
              source,
              translated: translation
                ? {
                    nome: translation.nome,
                    descrizione: translation.descrizione,
                    ingredienti: translation.ingredienti,
                  }
                : null,
              state: resolveState(translation, hashMenuItemSource(source)),
            };
          })
          .filter((row) => row.source.nome)
          .sort(
            (a, b) =>
              a.category.localeCompare(b.category, "it") ||
              a.source.nome.localeCompare(b.source.nome, "it"),
          ),
      );
    });

    const unsubscribeCategories = onSnapshot(
      collection(db, "menu_categories"),
      (snap) => {
        watchCategoryChanges(snap);
        setCategories(
          snap.docs
            .map((entry) => {
              const raw = entry.data() as Record<string, unknown>;
              const source = readCategorySource(raw);
              const translation = readCategoryTranslation(raw, locale);
              return {
                id: entry.id,
                source: source.nome,
                translated: translation?.nome ?? "",
                state: resolveState(translation, hashCategorySource(source)),
              };
            })
            .filter((row) => row.source)
            .sort((a, b) => a.source.localeCompare(b.source, "it")),
        );
      },
    );

    return () => {
      unsubscribeItems();
      unsubscribeCategories();
    };
  }, [locale]);

  const counts = useMemo(() => {
    const all = [...items, ...categories];
    return {
      reviewed: all.filter((row) => row.state === "reviewed").length,
      auto: all.filter((row) => row.state === "auto").length,
      pending: all.filter(
        (row) => row.state === "missing" || row.state === "outdated",
      ).length,
      total: all.length,
    };
  }, [items, categories]);

  const visibleItems =
    filter === "all" ? items : items.filter((row) => row.state !== "reviewed");
  const visibleCategories =
    filter === "all"
      ? categories
      : categories.filter((row) => row.state !== "reviewed");

  const translateAllPending = async () => {
    setError(null);
    setFeedback(null);
    let totalTranslated = 0;
    try {
      for (;;) {
        setBulkProgress(
          `Traduzione in corso... ${totalTranslated} voci tradotte finora`,
        );
        const result = await callTranslateApi(locale);
        const translatedNow =
          (result.translatedItems ?? 0) + (result.translatedCategories ?? 0);
        totalTranslated += translatedNow;
        const remaining =
          (result.remainingItems ?? 0) + (result.remainingCategories ?? 0);
        // translatedNow = 0 evita cicli infiniti se una voce non si traduce.
        if (remaining === 0 || translatedNow === 0) {
          setFeedback(
            remaining === 0
              ? `Fatto: ${totalTranslated} voci tradotte. Ora puoi rivederle qui sotto.`
              : `${totalTranslated} voci tradotte, ${remaining} non riuscite: riprova.`,
          );
          break;
        }
      }
    } catch (translateError) {
      setError(
        translateError instanceof Error
          ? translateError.message
          : "Traduzione non riuscita.",
      );
    } finally {
      setBulkProgress(null);
    }
  };

  const retranslateItem = async (row: ItemRow) => {
    setBusyId(row.id);
    setError(null);
    try {
      await callTranslateApi(locale, [row.id]);
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    } catch (translateError) {
      setError(
        translateError instanceof Error
          ? translateError.message
          : "Traduzione non riuscita.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const saveItemReview = async (row: ItemRow) => {
    const draft = drafts[row.id] ?? row.translated;
    if (!draft?.nome.trim()) {
      setError("Il nome tradotto non puo essere vuoto.");
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await updateDoc(doc(getClientDb(), "menu_items", row.id), {
        [`i18n.${locale}`]: {
          nome: draft.nome.trim(),
          descrizione: draft.descrizione.trim(),
          ingredienti: draft.ingredienti.trim(),
          status: "reviewed",
          // La revisione vale per l'italiano mostrato ora.
          sourceHash: hashMenuItemSource(row.source),
          updatedAt: new Date().toISOString(),
        },
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setFeedback(`"${row.source.nome}" segnato come rivisto.`);
    } catch {
      setError("Salvataggio non riuscito.");
    } finally {
      setBusyId(null);
    }
  };

  const saveCategoryReview = async (row: CategoryRow) => {
    const value = (categoryDrafts[row.id] ?? row.translated).trim();
    if (!value) {
      setError("Il nome tradotto della categoria non puo essere vuoto.");
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await updateDoc(doc(getClientDb(), "menu_categories", row.id), {
        [`i18n.${locale}`]: {
          nome: value,
          status: "reviewed",
          sourceHash: hashCategorySource({ nome: row.source }),
          updatedAt: new Date().toISOString(),
        },
      });
      setCategoryDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    } catch {
      setError("Salvataggio non riuscito.");
    } finally {
      setBusyId(null);
    }
  };

  const updateDraft = (
    row: ItemRow,
    field: keyof MenuItemSource,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [row.id]: {
        ...(current[row.id] ??
          row.translated ?? { nome: "", descrizione: "", ingredienti: "" }),
        [field]: value,
      },
    }));
  };

  return (
    <div className="translations-panel">
      <div className="admin-card translations-summary">
        <div className="admin-tabs translations-locales">
          {CONTENT_LOCALES.map((entry) => (
            <button
              key={entry}
              type="button"
              className={entry === locale ? "admin-tab active" : "admin-tab"}
              disabled={Boolean(bulkProgress)}
              onClick={() => {
                setLocale(entry);
                setDrafts({});
                setCategoryDrafts({});
                setFeedback(null);
                setError(null);
              }}
            >
              {LOCALE_LABELS[entry]}
            </button>
          ))}
        </div>
        <p className="section-subtitle">
          Le traduzioni automatiche vanno subito online. Chi conosce bene
          la lingua può rivederle qui e segnarle come riviste. Se cambi il
          testo italiano di un piatto, il menu tradotto mostra l&apos;italiano
          finché il piatto non viene ritradotto.
        </p>
        <div className="translations-counts">
          <span className="translations-state state-reviewed">
            Riviste: {counts.reviewed}
          </span>
          <span className="translations-state state-auto">
            Da rivedere: {counts.auto}
          </span>
          <span className="translations-state state-missing">
            Da tradurre: {counts.pending}
          </span>
        </div>
        <div className="translations-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={Boolean(bulkProgress) || counts.pending === 0}
            onClick={() => void translateAllPending()}
          >
            {bulkProgress ?? `Traduci automaticamente (${counts.pending})`}
          </button>
          <div className="admin-tabs">
            <button
              type="button"
              className={filter === "todo" ? "admin-tab active" : "admin-tab"}
              onClick={() => setFilter("todo")}
            >
              Da sistemare
            </button>
            <button
              type="button"
              className={filter === "all" ? "admin-tab active" : "admin-tab"}
              onClick={() => setFilter("all")}
            >
              Tutte
            </button>
          </div>
        </div>
        {feedback ? <p className="success-text">{feedback}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>

      {visibleCategories.length > 0 ? (
        <div className="admin-card">
          <h3>Categorie</h3>
          <div className="translations-list">
            {visibleCategories.map((row) => (
              <div key={row.id} className="translations-row">
                <div className="translations-row-head">
                  <strong>{row.source}</strong>
                  <span className={`translations-state state-${row.state}`}>
                    {STATE_LABELS[row.state]}
                  </span>
                </div>
                <div className="translations-inline">
                  <input
                    value={categoryDrafts[row.id] ?? row.translated}
                    placeholder={`Nome in ${LOCALE_LABELS[locale].toLowerCase()}`}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCategoryDrafts((current) => ({
                        ...current,
                        [row.id]: value,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="admin-mini-btn"
                    disabled={busyId === row.id}
                    onClick={() => void saveCategoryReview(row)}
                  >
                    Salva come rivista
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-card">
        <h3>Piatti</h3>
        {visibleItems.length === 0 ? (
          <p className="section-subtitle">
            {filter === "todo"
              ? "Tutti i piatti sono tradotti e rivisti."
              : "Nessun piatto."}
          </p>
        ) : (
          <div className="translations-list">
            {visibleItems.map((row) => {
              const draft = drafts[row.id] ??
                row.translated ?? { nome: "", descrizione: "", ingredienti: "" };
              const busy = busyId === row.id || Boolean(bulkProgress);
              return (
                <div key={row.id} className="translations-row">
                  <div className="translations-row-head">
                    <strong>{row.source.nome}</strong>
                    <span className="translations-category">{row.category}</span>
                    <span className={`translations-state state-${row.state}`}>
                      {STATE_LABELS[row.state]}
                    </span>
                  </div>

                  <div className="translations-grid">
                    <div className="translations-col">
                      <span className="translations-col-title">Italiano</span>
                      <p>{row.source.nome}</p>
                      {row.source.descrizione ? (
                        <p>{row.source.descrizione}</p>
                      ) : null}
                      {row.source.ingredienti ? (
                        <p className="translations-ingredients">
                          {row.source.ingredienti}
                        </p>
                      ) : null}
                    </div>
                    <div className="translations-col">
                      <span className="translations-col-title">{LOCALE_LABELS[locale]}</span>
                      <input
                        value={draft.nome}
                        placeholder="Name"
                        onChange={(event) =>
                          updateDraft(row, "nome", event.currentTarget.value)
                        }
                      />
                      {row.source.descrizione ? (
                        <textarea
                          rows={2}
                          value={draft.descrizione}
                          placeholder="Description"
                          onChange={(event) =>
                            updateDraft(
                              row,
                              "descrizione",
                              event.currentTarget.value,
                            )
                          }
                        />
                      ) : null}
                      {row.source.ingredienti ? (
                        <textarea
                          rows={2}
                          value={draft.ingredienti}
                          placeholder="Ingredients (comma separated)"
                          onChange={(event) =>
                            updateDraft(
                              row,
                              "ingredienti",
                              event.currentTarget.value,
                            )
                          }
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="translations-row-actions">
                    <button
                      type="button"
                      className="admin-mini-btn"
                      disabled={busy}
                      onClick={() => void retranslateItem(row)}
                    >
                      {busyId === row.id ? "..." : "Ritraduci"}
                    </button>
                    <button
                      type="button"
                      className="admin-mini-btn active"
                      disabled={busy || !draft.nome.trim()}
                      onClick={() => void saveItemReview(row)}
                    >
                      Salva come rivista
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
