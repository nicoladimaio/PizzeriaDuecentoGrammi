"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  CeleryIcon,
  CrustaceansIcon,
  EggsIcon,
  FishIcon,
  GlutenIcon,
  LupinsIcon,
  MilkIcon,
  MolluscsIcon,
  MustardIcon,
  PeanutsIcon,
  SesameIcon,
  SoyIcon,
  SulphitesIcon,
  TreeNutsIcon,
} from "@/components/allergens/allergen-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getClientDb, getClientStorage } from "@/lib/firebase";

type AdminMenuItem = {
  id: string;
  nome: string;
  ingredienti: string;
  prezzo: number;
  categoria: string;
  immagine: string;
  ordine: number;
  ingredientIds: string[];
  allergeni: string[];
  visible: boolean;
};

type MenuCategory = {
  id: string;
  name: string;
  ordine: number;
  visible: boolean;
};

type MenuIngredient = {
  id: string;
  name: string;
  ordine: number;
  allergeni: string[];
};

type AllergenDef = {
  key: string;
  label: string;
};

const ALLERGENS: AllergenDef[] = [
  { key: "glutine", label: "Glutine" },
  { key: "arachidi", label: "Arachidi" },
  { key: "sedano", label: "Sedano" },
  { key: "senape", label: "Senape" },
  { key: "sesamo", label: "Sesamo" },
  { key: "latte", label: "Latte" },
  { key: "uova", label: "Uova" },
  { key: "frutta_guscio", label: "Frutta a guscio" },
  { key: "soia", label: "Soia" },
  { key: "pesce", label: "Pesce" },
  { key: "crostacei", label: "Crostacei" },
  { key: "molluschi", label: "Molluschi" },
  { key: "lupini", label: "Lupini" },
  { key: "solfiti", label: "Solfiti" },
];

function AllergenIcon({ type }: { type: string }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "glutine":
      return <GlutenIcon aria-hidden {...iconProps} />;
    case "latte":
      return <MilkIcon aria-hidden {...iconProps} />;
    case "arachidi":
      return <PeanutsIcon aria-hidden {...iconProps} />;
    case "sedano":
      return <CeleryIcon aria-hidden {...iconProps} />;
    case "senape":
      return <MustardIcon aria-hidden {...iconProps} />;
    case "sesamo":
      return <SesameIcon aria-hidden {...iconProps} />;
    case "uova":
      return <EggsIcon aria-hidden {...iconProps} />;
    case "frutta_guscio":
      return <TreeNutsIcon aria-hidden {...iconProps} />;
    case "soia":
      return <SoyIcon aria-hidden {...iconProps} />;
    case "pesce":
      return <FishIcon aria-hidden {...iconProps} />;
    case "crostacei":
      return <CrustaceansIcon aria-hidden {...iconProps} />;
    case "molluschi":
      return <MolluscsIcon aria-hidden {...iconProps} />;
    case "lupini":
      return <LupinsIcon aria-hidden {...iconProps} />;
    case "solfiti":
      return <SulphitesIcon aria-hidden {...iconProps} />;
    default:
      return <SesameIcon aria-hidden {...iconProps} />;
  }
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 20L20 4" />
    </svg>
  );
}

const toString = (value: unknown): string => String(value ?? "").trim();

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toString(entry))
    .filter((entry) => entry.length > 0);
};

const uniqueInsensitive = (values: string[]): string[] => {
  const out: string[] = [];
  values.forEach((value) => {
    if (!out.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      out.push(value);
    }
  });
  return out;
};

const normalizePrice = (value: unknown): number | null => {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
};

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const reorderIds = (ids: string[], movingId: string, targetId: string) => {
  if (movingId === targetId) return ids;
  const next = [...ids];
  const from = next.indexOf(movingId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0) return ids;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const toggleInArray = (arr: string[], value: string): string[] => {
  const exists = arr.includes(value);
  if (exists) return arr.filter((entry) => entry !== value);
  return [...arr, value];
};

export function AdminMenuPanel() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [menuSubview, setMenuSubview] = useState<"dishes" | "ingredients">(
    "dishes",
  );
  const [activeCategory, setActiveCategory] = useState<string>("");

  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(
    null,
  );
  const [draggingModalCategoryId, setDraggingModalCategoryId] = useState<
    string | null
  >(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(
    null,
  );

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(
    {},
  );

  const [showAllergenFilters, setShowAllergenFilters] = useState(false);
  const [selectedAllergenFilters, setSelectedAllergenFilters] = useState<
    string[]
  >([]);

  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientAllergens, setNewIngredientAllergens] = useState<
    string[]
  >([]);
  const [ingredientEditName, setIngredientEditName] = useState("");
  const [ingredientEditAllergens, setIngredientEditAllergens] = useState<
    string[]
  >([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemIngredientIds, setNewItemIngredientIds] = useState<string[]>(
    [],
  );
  const [newItemAllergens, setNewItemAllergens] = useState<string[]>([]);
  const [showNewIngredientResults, setShowNewIngredientResults] =
    useState(false);
  const [newIngredientSearch, setNewIngredientSearch] = useState("");
  const [draggingNewIngredientId, setDraggingNewIngredientId] = useState<
    string | null
  >(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  const [editItemName, setEditItemName] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemIngredientIds, setEditItemIngredientIds] = useState<string[]>(
    [],
  );
  const [editItemAllergens, setEditItemAllergens] = useState<string[]>([]);
  const [showEditIngredientResults, setShowEditIngredientResults] =
    useState(false);
  const [editIngredientSearch, setEditIngredientSearch] = useState("");
  const [draggingEditIngredientId, setDraggingEditIngredientId] = useState<
    string | null
  >(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  const [showQuickIngredientCreate, setShowQuickIngredientCreate] =
    useState(false);
  const [quickIngredientName, setQuickIngredientName] = useState("");
  const [quickIngredientAllergens, setQuickIngredientAllergens] = useState<
    string[]
  >([]);
  const [quickIngredientTarget, setQuickIngredientTarget] = useState<
    "new" | "edit"
  >("new");

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(collection(db, "menu_items"), (snapshot) => {
      const next = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            nome: toString(data.nome ?? data.Nome),
            ingredienti: toString(data.ingredienti ?? data.Ingredienti),
            prezzo: normalizePrice(data.prezzo ?? data.Prezzo) ?? 0,
            categoria: toString(
              (data.categoria ?? data.Categoria) || "Pizze classiche",
            ),
            immagine: toString(
              (data.immagine ?? data.Immagine) || "assets/logo1.png",
            ),
            ordine: Number.isFinite(Number(data.ordine))
              ? Number(data.ordine)
              : Number.isFinite(Number(data.order))
                ? Number(data.order)
                : 9999,
            ingredientIds: uniqueInsensitive(
              parseStringArray(data.ingredientIds ?? data.ingredientiIds),
            ),
            allergeni: uniqueInsensitive(
              parseStringArray(data.allergeni ?? data.allergens),
            ),
            visible:
              typeof data.visible === "boolean"
                ? data.visible
                : typeof data.visibile === "boolean"
                  ? data.visibile
                  : true,
          };
        })
        .filter((item) => item.nome.length > 0)
        .sort((a, b) => {
          const categoryDiff = a.categoria.localeCompare(b.categoria, "it");
          if (categoryDiff !== 0) return categoryDiff;
          const orderDiff = a.ordine - b.ordine;
          if (orderDiff !== 0) return orderDiff;
          return a.nome.localeCompare(b.nome, "it");
        });

      setItems(next);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
        const next = snapshot.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: toString(data.name ?? data.nome),
              ordine: Number.isFinite(Number(data.ordine))
                ? Number(data.ordine)
                : Number.isFinite(Number(data.order))
                  ? Number(data.order)
                  : 9999,
              visible:
                typeof data.visible === "boolean"
                  ? data.visible
                  : typeof data.visibile === "boolean"
                    ? data.visibile
                    : true,
            };
          })
          .filter((item) => item.name.length > 0)
          .sort((a, b) => {
            const orderDiff = a.ordine - b.ordine;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          });

        setCategories(next);
        setCategoryDrafts((prev) => {
          const updated: Record<string, string> = {};
          next.forEach((item) => {
            updated[item.id] = prev[item.id] ?? item.name;
          });
          return updated;
        });
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_ingredients"),
      (snapshot) => {
        const next = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              name: toString(data.name ?? data.nome),
              ordine: Number.isFinite(Number(data.ordine))
                ? Number(data.ordine)
                : Number.isFinite(Number(data.order))
                  ? Number(data.order)
                  : 9999,
              allergeni: uniqueInsensitive(
                parseStringArray(data.allergeni ?? data.allergens),
              ),
            };
          })
          .filter((entry) => entry.name.length > 0)
          .sort((a, b) => {
            const orderDiff = a.ordine - b.ordine;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          });

        setIngredients(next);
      },
    );

    return () => unsubscribe();
  }, []);

  const categoryNames = useMemo(
    () => categories.map((category) => category.name),
    [categories],
  );

  const categoryVisibilityByName = useMemo(() => {
    const map: Record<string, boolean> = {};
    categories.forEach((category) => {
      map[category.name.toLowerCase()] = category.visible;
    });
    return map;
  }, [categories]);

  const ingredientMap = useMemo(() => {
    const map: Record<string, MenuIngredient> = {};
    ingredients.forEach((entry) => {
      map[entry.id] = entry;
    });
    return map;
  }, [ingredients]);

  const allergenMap = useMemo(() => {
    const map: Record<string, AllergenDef> = {};
    ALLERGENS.forEach((entry) => {
      map[entry.key] = entry;
    });
    return map;
  }, []);

  const visibleCategories = useMemo(() => {
    const fromItems = items
      .map((item) => item.categoria)
      .filter((name) => name.length > 0)
      .filter(
        (name, index, arr) =>
          arr.findIndex(
            (entry) => entry.toLowerCase() === name.toLowerCase(),
          ) === index,
      );

    const merged = [...categoryNames];
    fromItems.forEach((entry) => {
      const exists = merged.some(
        (category) => category.toLowerCase() === entry.toLowerCase(),
      );
      if (!exists) merged.push(entry);
    });

    return merged;
  }, [categoryNames, items]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      setActiveCategory("");
      return;
    }

    const exists = visibleCategories.some(
      (entry) => entry.toLowerCase() === activeCategory.toLowerCase(),
    );
    if (!exists) setActiveCategory(visibleCategories[0]);
  }, [visibleCategories, activeCategory]);

  useEffect(() => {
    if (!showItemModal) return;
    if (newItemCategory) return;

    const firstVisibleCategory = categories.find(
      (category) => category.visible,
    )?.name;
    if (firstVisibleCategory) {
      setNewItemCategory(firstVisibleCategory);
      return;
    }

    if (activeCategory) {
      setNewItemCategory(activeCategory);
      return;
    }

    setNewItemCategory(categoryNames[0] ?? "");
  }, [
    showItemModal,
    newItemCategory,
    categories,
    activeCategory,
    categoryNames,
  ]);

  useEffect(() => {
    if (showItemModal) return;
    setShowNewIngredientResults(false);
    setNewIngredientSearch("");
    setDraggingNewIngredientId(null);
  }, [showItemModal]);

  useEffect(() => {
    if (editingItemId) return;
    setShowEditIngredientResults(false);
    setEditIngredientSearch("");
    setDraggingEditIngredientId(null);
  }, [editingItemId]);

  const itemsByCategory = useMemo(() => {
    return items.reduce<Record<string, AdminMenuItem[]>>((acc, item) => {
      const key = item.categoria || "Altro";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const visibleItems = useMemo(() => {
    const list = itemsByCategory[activeCategory] ?? [];
    return [...list].sort((a, b) => {
      const orderDiff = a.ordine - b.ordine;
      if (orderDiff !== 0) return orderDiff;
      return a.nome.localeCompare(b.nome, "it");
    });
  }, [itemsByCategory, activeCategory]);

  const filteredIngredients = useMemo(() => {
    if (selectedAllergenFilters.length === 0) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.allergeni.some((key) => selectedAllergenFilters.includes(key)),
    );
  }, [ingredients, selectedAllergenFilters]);

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.visible),
    [categories],
  );

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [items, editingItemId],
  );

  const filteredNewIngredientOptions = useMemo(() => {
    const query = newIngredientSearch.trim().toLowerCase();
    if (!query) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query),
    );
  }, [ingredients, newIngredientSearch]);

  const filteredEditIngredientOptions = useMemo(() => {
    const query = editIngredientSearch.trim().toLowerCase();
    if (!query) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query),
    );
  }, [ingredients, editIngredientSearch]);

  const newDetectedAllergenKeys = useMemo(
    () => inferAllergensFromIngredientIds(newItemIngredientIds),
    [newItemIngredientIds, ingredientMap],
  );

  const newSelectableExtraAllergens = useMemo(
    () =>
      ALLERGENS.filter(
        (allergen) => !newDetectedAllergenKeys.includes(allergen.key),
      ),
    [newDetectedAllergenKeys],
  );

  const editDetectedAllergenKeys = useMemo(
    () => inferAllergensFromIngredientIds(editItemIngredientIds),
    [editItemIngredientIds, ingredientMap],
  );

  const editSelectableExtraAllergens = useMemo(
    () =>
      ALLERGENS.filter(
        (allergen) => !editDetectedAllergenKeys.includes(allergen.key),
      ),
    [editDetectedAllergenKeys],
  );

  const newImagePreview = useMemo(() => {
    if (!newImageFile) return "";
    return URL.createObjectURL(newImageFile);
  }, [newImageFile]);

  const editImagePreview = useMemo(() => {
    if (!editImageFile) return "";
    return URL.createObjectURL(editImageFile);
  }, [editImageFile]);

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

  useEffect(() => {
    return () => {
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    };
  }, [editImagePreview]);

  const uploadImage = async (file: File): Promise<string> => {
    const storage = getClientStorage();
    const path = `menu-items/${Date.now()}-${sanitizeFileName(file.name)}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, file);
    return getDownloadURL(imageRef);
  };

  const ensureCategoryExists = async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    const exists = categoryNames.some(
      (entry) => entry.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return;

    const db = getClientDb();
    await addDoc(collection(db, "menu_categories"), {
      name: normalized,
      ordine: categories.length,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const getIngredientNames = (ids: string[]): string[] =>
    ids
      .map((id) => ingredientMap[id]?.name ?? "")
      .filter((name) => name.length > 0);

  const buildIngredientText = (ids: string[]): string => {
    const fromSelection = getIngredientNames(ids);
    return fromSelection.join(", ");
  };

  function inferAllergensFromIngredientIds(ids: string[]): string[] {
    const inferred = ids.flatMap((id) => ingredientMap[id]?.allergeni ?? []);
    return uniqueInsensitive(inferred);
  }

  const addIngredientFromQuery = (
    query: string,
    selectedIds: string[],
    setSelectedIds: Dispatch<SetStateAction<string[]>>,
  ): boolean => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 3) return false;

    const exact = ingredients.find(
      (ingredient) => ingredient.name.toLowerCase() === normalized,
    );
    const firstMatch =
      exact ??
      ingredients.find((ingredient) =>
        ingredient.name.toLowerCase().includes(normalized),
      );
    if (!firstMatch) return false;
    if (selectedIds.includes(firstMatch.id)) return false;

    setSelectedIds((prev) => [...prev, firstMatch.id]);
    return true;
  };

  const addAllergenFromQuery = (
    query: string,
    selectedKeys: string[],
    setSelectedKeys: Dispatch<SetStateAction<string[]>>,
  ) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    const exact = ALLERGENS.find(
      (allergen) => allergen.label.toLowerCase() === normalized,
    );
    const firstMatch =
      exact ??
      ALLERGENS.find((allergen) =>
        allergen.label.toLowerCase().includes(normalized),
      );
    if (!firstMatch) return;
    if (selectedKeys.includes(firstMatch.key)) return;

    setSelectedKeys((prev) => [...prev, firstMatch.key]);
  };

  const saveNewIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    if (newIngredientName.trim().length < 2) {
      setBusy(false);
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    try {
      const db = getClientDb();
      const already = ingredients.find(
        (entry) =>
          entry.name.toLowerCase() === newIngredientName.trim().toLowerCase(),
      );
      if (already) {
        setError("Ingrediente gia presente.");
        setBusy(false);
        return;
      }

      await addDoc(collection(db, "menu_ingredients"), {
        name: newIngredientName.trim(),
        ordine: ingredients.length,
        allergeni: uniqueInsensitive(newIngredientAllergens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setShowIngredientModal(false);
      setNewIngredientName("");
      setNewIngredientAllergens([]);
      setFeedback("Ingrediente aggiunto.");
    } catch {
      setError("Errore durante aggiunta ingrediente.");
    } finally {
      setBusy(false);
    }
  };

  const openIngredientEdit = (ingredient: MenuIngredient) => {
    setEditingIngredientId(ingredient.id);
    setIngredientEditName(ingredient.name);
    setIngredientEditAllergens(ingredient.allergeni);
    setError(null);
    setFeedback(null);
  };

  const saveIngredientEdit = async () => {
    if (!editingIngredientId) return;
    if (ingredientEditName.trim().length < 2) {
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    setSavingId(editingIngredientId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_ingredients", editingIngredientId), {
        name: ingredientEditName.trim(),
        allergeni: uniqueInsensitive(ingredientEditAllergens),
        updatedAt: new Date().toISOString(),
      });
      setEditingIngredientId(null);
      setIngredientEditName("");
      setIngredientEditAllergens([]);
      setFeedback("Ingrediente aggiornato.");
    } catch {
      setError("Errore durante modifica ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  const removeIngredient = async (ingredientId: string) => {
    const inUse = items.some((item) =>
      item.ingredientIds.includes(ingredientId),
    );
    if (inUse) {
      setError("Ingrediente in uso nei piatti. Rimuovilo prima dai piatti.");
      return;
    }

    setSavingId(ingredientId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_ingredients", ingredientId));
      setFeedback("Ingrediente eliminato.");
    } catch {
      setError("Errore durante eliminazione ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    if (newCategoryName.trim().length < 2) {
      setBusy(false);
      setError("La categoria deve contenere almeno 2 caratteri.");
      return;
    }

    try {
      const normalized = newCategoryName.trim();
      await ensureCategoryExists(normalized);
      setActiveCategory(normalized);
      setNewCategoryName("");
      setShowCategoryModal(false);
      setFeedback("Categoria salvata.");
    } catch {
      setError("Errore durante il salvataggio categoria.");
    } finally {
      setBusy(false);
    }
  };

  const renameCategory = async (categoryId: string) => {
    const name = toString(categoryDrafts[categoryId]);
    if (name.length < 2) {
      setError("La categoria deve contenere almeno 2 caratteri.");
      return;
    }

    setSavingId(categoryId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_categories", categoryId), {
        name,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Categoria aggiornata.");
    } catch {
      setError("Errore durante modifica categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleCategoryVisibility = async (category: MenuCategory) => {
    setSavingId(category.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_categories", category.id), {
        visible: !category.visible,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Visibilita categoria aggiornata.");
    } catch {
      setError("Errore durante aggiornamento visibilita categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const removeCategory = async (category: MenuCategory) => {
    const used = items.some(
      (item) => item.categoria.toLowerCase() === category.name.toLowerCase(),
    );
    if (used) {
      setError("Categoria in uso nel menu. Modifica prima i piatti associati.");
      return;
    }

    setSavingId(category.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_categories", category.id));
      setFeedback("Categoria eliminata.");
    } catch {
      setError("Errore durante eliminazione categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    const prezzo = normalizePrice(newItemPrice);
    const categoria = newItemCategory.trim();

    if (newItemName.trim().length < 2) {
      setBusy(false);
      setError("Il nome deve contenere almeno 2 caratteri.");
      return;
    }

    if (!categoria) {
      setBusy(false);
      setError("La categoria e obbligatoria.");
      return;
    }

    if (prezzo === null) {
      setBusy(false);
      setError("Prezzo non valido. Usa solo numeri, es. 8.50.");
      return;
    }

    const ingredientIds = uniqueInsensitive(newItemIngredientIds);
    if (ingredientIds.length === 0) {
      setBusy(false);
      setError("Seleziona almeno un ingrediente.");
      return;
    }

    try {
      const db = getClientDb();
      await ensureCategoryExists(categoria);
      const uploadedImage = newImageFile
        ? await uploadImage(newImageFile)
        : "assets/logo1.png";

      const currentCategoryItems = items.filter(
        (item) => item.categoria.toLowerCase() === categoria.toLowerCase(),
      );

      const inferredAllergens = inferAllergensFromIngredientIds(ingredientIds);
      const allergeni = uniqueInsensitive([
        ...inferredAllergens,
        ...newItemAllergens,
      ]);
      const ingredientiText = buildIngredientText(ingredientIds);

      await addDoc(collection(db, "menu_items"), {
        nome: newItemName.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria,
        immagine: uploadedImage,
        ordine: currentCategoryItems.length,
        ingredientIds,
        allergeni,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setNewItemName("");
      setNewItemPrice("");
      setNewItemCategory(categoria);
      setNewItemIngredientIds([]);
      setNewItemAllergens([]);
      setNewImageFile(null);
      setShowItemModal(false);
      setFeedback("Piatto aggiunto.");
    } catch {
      setError("Errore durante il salvataggio del piatto.");
    } finally {
      setBusy(false);
    }
  };

  const openEditItem = (item: AdminMenuItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.nome);
    setEditItemPrice(String(item.prezzo));
    setEditItemCategory(item.categoria);
    setEditItemIngredientIds(item.ingredientIds);
    const detected = inferAllergensFromIngredientIds(item.ingredientIds);
    setEditItemAllergens(
      item.allergeni.filter((key) => !detected.includes(key)),
    );
    setShowEditIngredientResults(false);
    setEditIngredientSearch("");
    setDraggingEditIngredientId(null);
    setEditImageFile(null);
    setError(null);
    setFeedback(null);
  };

  const saveEditedItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingItemId || !editingItem) return;

    const prezzo = normalizePrice(editItemPrice);

    if (editItemName.trim().length < 2) {
      setError("Il nome deve contenere almeno 2 caratteri.");
      return;
    }

    if (!editItemCategory.trim()) {
      setError("La categoria e obbligatoria.");
      return;
    }

    if (prezzo === null) {
      setError("Prezzo non valido. Usa solo numeri, es. 8.50.");
      return;
    }

    const ingredientIds = uniqueInsensitive(editItemIngredientIds);
    if (ingredientIds.length === 0) {
      setError("Seleziona almeno un ingrediente.");
      return;
    }

    setSavingId(editingItemId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const uploadedImage = editImageFile
        ? await uploadImage(editImageFile)
        : editingItem.immagine;

      const inferredAllergens = inferAllergensFromIngredientIds(ingredientIds);
      const allergeni = uniqueInsensitive([
        ...inferredAllergens,
        ...editItemAllergens,
      ]);
      const ingredientiText = buildIngredientText(ingredientIds);

      await updateDoc(doc(db, "menu_items", editingItemId), {
        nome: editItemName.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria: editItemCategory.trim(),
        immagine: uploadedImage,
        ingredientIds,
        allergeni,
        updatedAt: new Date().toISOString(),
      });

      setEditingItemId(null);
      setEditImageFile(null);
      setEditItemIngredientIds([]);
      setEditItemAllergens([]);
      setFeedback("Piatto aggiornato.");
    } catch {
      setError("Errore durante il salvataggio della modifica.");
    } finally {
      setSavingId(null);
    }
  };

  const openQuickCreateIngredient = (name: string, target: "new" | "edit") => {
    setQuickIngredientName(name.trim());
    setQuickIngredientAllergens([]);
    setQuickIngredientTarget(target);
    setShowQuickIngredientCreate(true);
  };

  const saveQuickIngredient = async () => {
    const normalized = quickIngredientName.trim();
    if (normalized.length < 2) {
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const existing = ingredients.find(
        (entry) => entry.name.toLowerCase() === normalized.toLowerCase(),
      );

      if (existing) {
        if (quickIngredientTarget === "new") {
          setNewItemIngredientIds((prev) => toggleInArray(prev, existing.id));
          setShowNewIngredientResults(false);
          setNewIngredientSearch("");
        } else {
          setEditItemIngredientIds((prev) => toggleInArray(prev, existing.id));
          setShowEditIngredientResults(false);
          setEditIngredientSearch("");
        }
        setShowQuickIngredientCreate(false);
        return;
      }

      const db = getClientDb();
      const created = await addDoc(collection(db, "menu_ingredients"), {
        name: normalized,
        ordine: ingredients.length,
        allergeni: uniqueInsensitive(quickIngredientAllergens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (quickIngredientTarget === "new") {
        setNewItemIngredientIds((prev) => toggleInArray(prev, created.id));
        setShowNewIngredientResults(false);
        setNewIngredientSearch("");
      } else {
        setEditItemIngredientIds((prev) => toggleInArray(prev, created.id));
        setShowEditIngredientResults(false);
        setEditIngredientSearch("");
      }

      setShowQuickIngredientCreate(false);
      setQuickIngredientName("");
      setQuickIngredientAllergens([]);
      setFeedback("Ingrediente creato e selezionato.");
    } catch {
      setError("Errore durante creazione ingrediente.");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setSavingId(itemId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_items", itemId));
      setFeedback("Piatto eliminato.");
    } catch {
      setError("Errore durante la rimozione del piatto.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleItemVisibility = async (item: AdminMenuItem) => {
    setSavingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_items", item.id), {
        visible: !item.visible,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError("Errore durante aggiornamento visibilita.");
    } finally {
      setSavingId(null);
    }
  };

  const reorderCategories = async (movingId: string, targetId: string) => {
    const orderedIds = categories.map((entry) => entry.id);
    const nextIds = reorderIds(orderedIds, movingId, targetId);
    if (nextIds.join("|") === orderedIds.join("|")) return;

    setBusy(true);
    setError(null);
    try {
      const db = getClientDb();
      await Promise.all(
        nextIds.map((categoryId, index) =>
          updateDoc(doc(db, "menu_categories", categoryId), {
            ordine: index,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      setFeedback("Ordine categorie aggiornato.");
    } catch {
      setError("Errore durante riordino categorie.");
    } finally {
      setBusy(false);
    }
  };

  const reorderCategoryItems = async (movingId: string, targetId: string) => {
    const currentIds = visibleItems.map((item) => item.id);
    const nextIds = reorderIds(currentIds, movingId, targetId);
    if (nextIds.join("|") === currentIds.join("|")) return;

    setBusy(true);
    setError(null);
    try {
      const db = getClientDb();
      await Promise.all(
        nextIds.map((itemId, index) =>
          updateDoc(doc(db, "menu_items", itemId), {
            ordine: index,
            categoria: activeCategory,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      setFeedback("Ordine piatti aggiornato.");
    } catch {
      setError("Errore durante riordino piatti.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-shell">
      {feedback ? <p className="success-text">{feedback}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <p className="section-subtitle">Caricamento menu remoto...</p>
      ) : null}

      <div className="admin-tabs">
        <button
          type="button"
          className={
            menuSubview === "dishes" ? "admin-tab active" : "admin-tab"
          }
          onClick={() => {
            setMenuSubview("dishes");
          }}
        >
          Piatti
        </button>
        <button
          type="button"
          className={
            menuSubview === "ingredients" ? "admin-tab active" : "admin-tab"
          }
          onClick={() => {
            setMenuSubview("ingredients");
          }}
        >
          Ingredienti
        </button>
      </div>

      {menuSubview === "dishes" ? (
        <>
          <div className="admin-menu-toolbar minimal-right">
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => {
                setShowCategoryModal(true);
              }}
            >
              + Categoria
            </button>
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => {
                setShowItemModal(true);
              }}
            >
              + Nuovo piatto
            </button>
          </div>

          <div
            className="category-scroll"
            role="tablist"
            aria-label="Categorie menu"
          >
            {visibleCategories.map((categoryName) => {
              const categoryDoc = categories.find(
                (entry) =>
                  entry.name.toLowerCase() === categoryName.toLowerCase(),
              );
              const categoryId = categoryDoc?.id ?? null;
              const isVisible =
                categoryVisibilityByName[categoryName.toLowerCase()] ?? true;

              return (
                <button
                  key={categoryName}
                  type="button"
                  role="tab"
                  draggable={Boolean(categoryId)}
                  onDragStart={() => {
                    if (categoryId) setDraggingCategoryId(categoryId);
                  }}
                  onDragOver={(event) => {
                    if (categoryId) event.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggingCategoryId && categoryId) {
                      void reorderCategories(draggingCategoryId, categoryId);
                    }
                    setDraggingCategoryId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingCategoryId(null);
                  }}
                  className={
                    activeCategory === categoryName
                      ? "category-pill active"
                      : isVisible
                        ? "category-pill"
                        : "category-pill category-pill-muted"
                  }
                  onClick={() => {
                    setActiveCategory(categoryName);
                  }}
                >
                  {categoryName}
                  {!isVisible ? (
                    <span className="pill-state"> (nascosta)</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <article className="admin-card empty-state-card">
              <p className="section-subtitle">Nessun piatto disponibile</p>
            </article>
          ) : (
            <div className="admin-grid modern-grid compact-cards dish-square-grid">
              {visibleItems.map((item) => (
                <article
                  className={
                    item.visible
                      ? "admin-dish-card admin-dish-card-compact"
                      : "admin-dish-card admin-dish-card-compact admin-dish-card-hidden"
                  }
                  key={item.id}
                  draggable
                  onDragStart={() => {
                    setDraggingItemId(item.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggingItemId) {
                      void reorderCategoryItems(draggingItemId, item.id);
                    }
                    setDraggingItemId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingItemId(null);
                  }}
                >
                  <div className="admin-dish-media-wrap compact">
                    <img
                      src={item.immagine || "assets/logo1.png"}
                      alt={item.nome}
                      className="admin-dish-media"
                    />
                  </div>
                  <div className="admin-dish-body compact">
                    <div className="admin-dish-head">
                      <h3>{item.nome}</h3>
                      <span className="dish-price compact">
                        {item.prezzo.toFixed(2)} EUR
                      </span>
                    </div>
                    <p className="admin-dish-desc compact">
                      {item.ingredienti || "Nessuna descrizione"}
                    </p>
                    {item.allergeni.length > 0 ? (
                      <div className="chip-wrap">
                        {item.allergeni.map((key) => (
                          <span
                            className="allergen-mini-icon"
                            key={`${item.id}-${key}`}
                            title={allergenMap[key]?.label ?? key}
                          >
                            <AllergenIcon type={key} />
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="admin-dish-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Modifica ${item.nome}`}
                        onClick={() => {
                          openEditItem(item);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Visibilita ${item.nome}`}
                        disabled={savingId === item.id}
                        onClick={() => {
                          void toggleItemVisibility(item);
                        }}
                      >
                        <VisibilityIcon visible={item.visible} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Elimina ${item.nome}`}
                        disabled={savingId === item.id}
                        onClick={() => {
                          void removeItem(item.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {menuSubview === "ingredients" ? (
        <>
          <div className="admin-menu-toolbar minimal-right">
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => {
                setShowAllergenFilters(true);
              }}
            >
              Filtra allergeni
            </button>
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => {
                setShowIngredientModal(true);
              }}
            >
              + Ingrediente
            </button>
          </div>

          <div className="admin-grid compact-cards ingredient-square-grid">
            {filteredIngredients.map((ingredient) => {
              return (
                <article
                  className="ingredient-square-card reduced"
                  key={ingredient.id}
                >
                  <h4>{ingredient.name}</h4>
                  <div className="chip-wrap">
                    {ingredient.allergeni.map((key) => (
                      <span className="allergen-chip" key={key}>
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={key} />
                        </span>
                        <span>{allergenMap[key]?.label ?? key}</span>
                      </span>
                    ))}
                  </div>
                  <div className="admin-dish-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        openIngredientEdit(ingredient);
                      }}
                      aria-label={`Modifica ingrediente ${ingredient.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      disabled={savingId === ingredient.id}
                      onClick={() => {
                        void removeIngredient(ingredient.id);
                      }}
                      aria-label={`Elimina ingrediente ${ingredient.name}`}
                    >
                      🗑
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {showCategoryModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Gestisci categorie"
          >
            <div className="admin-modal-head">
              <h3>Categorie</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowCategoryModal(false);
                }}
                aria-label="Chiudi popup categorie"
              >
                ×
              </button>
            </div>

            <form className="booking-form" onSubmit={addCategory}>
              <label>
                Nuova categoria
                <input
                  value={newCategoryName}
                  onChange={(event) => {
                    setNewCategoryName(event.currentTarget.value);
                  }}
                  placeholder="Es. Pizze speciali"
                  required
                />
              </label>
              <button className="btn-success" type="submit" disabled={busy}>
                Aggiungi
              </button>
            </form>

            <div className="category-list drag-sort-category-list">
              {categories.map((category) => (
                <div
                  className="category-row draggable"
                  key={category.id}
                  draggable
                  onDragStart={() => {
                    setDraggingModalCategoryId(category.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggingModalCategoryId) {
                      void reorderCategories(
                        draggingModalCategoryId,
                        category.id,
                      );
                    }
                    setDraggingModalCategoryId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingModalCategoryId(null);
                  }}
                >
                  <span className="drag-grip" aria-hidden>
                    ⠿
                  </span>
                  <input
                    value={categoryDrafts[category.id] ?? category.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCategoryDrafts((prev) => ({
                        ...prev,
                        [category.id]: value,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Visibilita categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void toggleCategoryVisibility(category);
                    }}
                  >
                    <VisibilityIcon visible={category.visible} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Modifica categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void renameCategory(category.id);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Elimina categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void removeCategory(category);
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showAllergenFilters ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Filtra ingredienti per allergeni"
          >
            <div className="admin-modal-head">
              <h3>Filtra per allergeni</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowAllergenFilters(false);
                }}
                aria-label="Chiudi popup filtri allergeni"
              >
                ×
              </button>
            </div>

            <div className="allergen-grid modern-allergen-grid">
              {ALLERGENS.map((allergen) => {
                const active = selectedAllergenFilters.includes(allergen.key);
                return (
                  <button
                    key={allergen.key}
                    type="button"
                    className={
                      active
                        ? "allergen-card filter active"
                        : "allergen-card filter"
                    }
                    onClick={() => {
                      setSelectedAllergenFilters((prev) =>
                        toggleInArray(prev, allergen.key),
                      );
                    }}
                  >
                    <span className="allergen-icon modern" aria-hidden>
                      <AllergenIcon type={allergen.key} />
                    </span>
                    <span>{allergen.label}</span>
                  </button>
                );
              })}
            </div>

            <div
              className="admin-menu-toolbar minimal-right"
              style={{ marginTop: "0.9rem" }}
            >
              <button
                type="button"
                className="admin-mini-btn"
                onClick={() => {
                  setSelectedAllergenFilters([]);
                }}
              >
                Reset filtri
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setShowAllergenFilters(false);
                }}
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showIngredientModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Aggiungi ingrediente"
          >
            <div className="admin-modal-head">
              <h3>Nuovo ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowIngredientModal(false);
                }}
                aria-label="Chiudi popup ingrediente"
              >
                ×
              </button>
            </div>
            <form className="booking-form" onSubmit={saveNewIngredient}>
              <label>
                Nome ingrediente
                <input
                  value={newIngredientName}
                  onChange={(event) => {
                    setNewIngredientName(event.currentTarget.value);
                  }}
                  required
                />
              </label>
              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = newIngredientAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setNewIngredientAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>
              <button className="btn-success" type="submit" disabled={busy}>
                Salva ingrediente
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingIngredientId ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modifica ingrediente"
          >
            <div className="admin-modal-head">
              <h3>Modifica ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingIngredientId(null);
                  setIngredientEditName("");
                  setIngredientEditAllergens([]);
                }}
                aria-label="Chiudi popup modifica ingrediente"
              >
                ×
              </button>
            </div>
            <form
              className="booking-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveIngredientEdit();
              }}
            >
              <label>
                Nome
                <input
                  value={ingredientEditName}
                  onChange={(event) => {
                    setIngredientEditName(event.currentTarget.value);
                  }}
                />
              </label>
              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = ingredientEditAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setIngredientEditAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>
              <div className="admin-menu-toolbar minimal-right">
                <button
                  type="button"
                  className="admin-mini-btn"
                  onClick={() => {
                    setEditingIngredientId(null);
                    setIngredientEditName("");
                    setIngredientEditAllergens([]);
                  }}
                >
                  Annulla
                </button>
                <button
                  className="btn-success"
                  type="submit"
                  disabled={savingId === editingIngredientId}
                >
                  {savingId === editingIngredientId
                    ? "Salvataggio..."
                    : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showItemModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Aggiungi piatto"
          >
            <div className="admin-modal-head">
              <h3>Nuovo piatto</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowItemModal(false);
                }}
                aria-label="Chiudi popup piatti"
              >
                ×
              </button>
            </div>

            <form className="booking-form" onSubmit={createItem}>
              <label>
                Nome
                <input
                  value={newItemName}
                  onChange={(event) => {
                    setNewItemName(event.currentTarget.value);
                  }}
                  required
                />
              </label>

              <div className="two-cols">
                <label>
                  Prezzo
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(event) => {
                      setNewItemPrice(event.currentTarget.value);
                    }}
                    required
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={newItemCategory}
                    onChange={(event) => {
                      setNewItemCategory(event.currentTarget.value);
                    }}
                    required
                  >
                    <option value="" disabled>
                      Seleziona categoria
                    </option>
                    {selectableCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Ingredienti
                <div className="ingredient-picker-wrap">
                  <input
                    className="chip-dropdown-input ingredient-search-input"
                    value={newIngredientSearch}
                    onFocus={() => {
                      setShowNewIngredientResults(
                        newIngredientSearch.trim().length >= 3,
                      );
                    }}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setNewIngredientSearch(value);
                      setShowNewIngredientResults(value.trim().length >= 3);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const added = addIngredientFromQuery(
                        newIngredientSearch,
                        newItemIngredientIds,
                        setNewItemIngredientIds,
                      );
                      if (added) {
                        setNewIngredientSearch("");
                        setShowNewIngredientResults(false);
                      }
                    }}
                    placeholder="Cerca o aggiungi ingrediente..."
                  />
                  {showNewIngredientResults &&
                  newIngredientSearch.trim().length >= 3 ? (
                    <div className="ingredient-search-dropdown">
                      {filteredNewIngredientOptions.length > 0 ? (
                        filteredNewIngredientOptions
                          .slice(0, 10)
                          .map((ingredient) => {
                            const active = newItemIngredientIds.includes(
                              ingredient.id,
                            );
                            return (
                              <button
                                type="button"
                                key={ingredient.id}
                                className={
                                  active
                                    ? "ingredient-search-item active"
                                    : "ingredient-search-item"
                                }
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setNewItemIngredientIds((prev) =>
                                    toggleInArray(prev, ingredient.id),
                                  );
                                  setShowNewIngredientResults(false);
                                  setNewIngredientSearch("");
                                }}
                              >
                                <div>
                                  <strong>{ingredient.name}</strong>
                                  {ingredient.allergeni.length > 0 ? (
                                    <div className="chip-wrap">
                                      {ingredient.allergeni.map((key) => (
                                        <span
                                          className="allergen-chip"
                                          key={`${ingredient.id}-${key}`}
                                        >
                                          <span
                                            className="allergen-mini-icon"
                                            aria-hidden
                                          >
                                            <AllergenIcon type={key} />
                                          </span>
                                          <span>
                                            {allergenMap[key]?.label ?? key}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                      ) : (
                        <div className="ingredient-empty-state">
                          <p>Nessun ingrediente trovato</p>
                          <button
                            type="button"
                            className="admin-mini-btn"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              openQuickCreateIngredient(
                                newIngredientSearch,
                                "new",
                              );
                            }}
                          >
                            + Crea "
                            {newIngredientSearch.trim() || "Nuovo ingrediente"}"
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="ingredient-selected-head">
                  <strong>
                    Ingredienti selezionati ({newItemIngredientIds.length})
                  </strong>
                </div>
                <div className="chip-wrap selected-chip-preview">
                  {newItemIngredientIds.map((ingredientId) => {
                    const ingredient = ingredientMap[ingredientId];
                    if (!ingredient) return null;
                    return (
                      <button
                        type="button"
                        key={ingredientId}
                        className="ingredient-chip ordered-chip"
                        draggable
                        onDragStart={() => {
                          setDraggingNewIngredientId(ingredientId);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!draggingNewIngredientId) return;
                          setNewItemIngredientIds((prev) =>
                            reorderIds(
                              prev,
                              draggingNewIngredientId,
                              ingredientId,
                            ),
                          );
                          setDraggingNewIngredientId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingNewIngredientId(null);
                        }}
                        onClick={() => {
                          setNewItemIngredientIds((prev) =>
                            prev.filter((id) => id !== ingredientId),
                          );
                        }}
                        title="Trascina per riordinare, clicca per rimuovere"
                      >
                        <span aria-hidden>✓</span>
                        <span>{ingredient.name}</span>
                        <span aria-hidden>✕</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni rilevati</strong>
                </div>
                <div className="chip-wrap">
                  {newDetectedAllergenKeys.length > 0 ? (
                    newDetectedAllergenKeys.map((key) => (
                      <span
                        className="allergen-chip"
                        key={`new-detected-${key}`}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={key} />
                        </span>
                        <span>{allergenMap[key]?.label ?? key}</span>
                      </span>
                    ))
                  ) : (
                    <span className="section-subtitle">
                      Nessun allergene rilevato
                    </span>
                  )}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni extra</strong>
                </div>
                <div className="allergen-picker compact">
                  {newSelectableExtraAllergens.map((allergen) => {
                    const active = newItemAllergens.includes(allergen.key);
                    return (
                      <button
                        key={allergen.key}
                        type="button"
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setNewItemAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <label>
                Immagine
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    setNewImageFile(file);
                  }}
                />
              </label>

              {newImagePreview ? (
                <div className="admin-preview-box">
                  <img
                    src={newImagePreview}
                    alt="Anteprima nuovo piatto"
                    className="admin-preview-image"
                  />
                </div>
              ) : null}

              <button className="btn-success" type="submit" disabled={busy}>
                {busy ? "Salvataggio..." : "Salva"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modifica piatto"
          >
            <div className="admin-modal-head">
              <h3>Modifica piatto</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingItemId(null);
                }}
                aria-label="Chiudi modifica piatto"
              >
                ×
              </button>
            </div>

            <form className="booking-form" onSubmit={saveEditedItem}>
              <label>
                Nome
                <input
                  value={editItemName}
                  onChange={(event) => {
                    setEditItemName(event.currentTarget.value);
                  }}
                  required
                />
              </label>

              <div className="two-cols">
                <label>
                  Prezzo
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={editItemPrice}
                    onChange={(event) => {
                      setEditItemPrice(event.currentTarget.value);
                    }}
                    required
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={editItemCategory}
                    onChange={(event) => {
                      setEditItemCategory(event.currentTarget.value);
                    }}
                    required
                  >
                    <option value="" disabled>
                      Seleziona categoria
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Ingredienti
                <div className="ingredient-picker-wrap">
                  <input
                    className="chip-dropdown-input ingredient-search-input"
                    value={editIngredientSearch}
                    onFocus={() => {
                      setShowEditIngredientResults(
                        editIngredientSearch.trim().length >= 3,
                      );
                    }}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setEditIngredientSearch(value);
                      setShowEditIngredientResults(value.trim().length >= 3);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const added = addIngredientFromQuery(
                        editIngredientSearch,
                        editItemIngredientIds,
                        setEditItemIngredientIds,
                      );
                      if (added) {
                        setEditIngredientSearch("");
                        setShowEditIngredientResults(false);
                      }
                    }}
                    placeholder="Cerca o aggiungi ingrediente..."
                  />
                  {showEditIngredientResults &&
                  editIngredientSearch.trim().length >= 3 ? (
                    <div className="ingredient-search-dropdown">
                      {filteredEditIngredientOptions.length > 0 ? (
                        filteredEditIngredientOptions
                          .slice(0, 10)
                          .map((ingredient) => {
                            const active = editItemIngredientIds.includes(
                              ingredient.id,
                            );
                            return (
                              <button
                                type="button"
                                key={ingredient.id}
                                className={
                                  active
                                    ? "ingredient-search-item active"
                                    : "ingredient-search-item"
                                }
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  setEditItemIngredientIds((prev) =>
                                    toggleInArray(prev, ingredient.id),
                                  );
                                  setShowEditIngredientResults(false);
                                  setEditIngredientSearch("");
                                }}
                              >
                                <div>
                                  <strong>{ingredient.name}</strong>
                                  {ingredient.allergeni.length > 0 ? (
                                    <div className="chip-wrap">
                                      {ingredient.allergeni.map((key) => (
                                        <span
                                          className="allergen-chip"
                                          key={`${ingredient.id}-${key}`}
                                        >
                                          <span
                                            className="allergen-mini-icon"
                                            aria-hidden
                                          >
                                            <AllergenIcon type={key} />
                                          </span>
                                          <span>
                                            {allergenMap[key]?.label ?? key}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                      ) : (
                        <div className="ingredient-empty-state">
                          <p>Nessun ingrediente trovato</p>
                          <button
                            type="button"
                            className="admin-mini-btn"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              openQuickCreateIngredient(
                                editIngredientSearch,
                                "edit",
                              );
                            }}
                          >
                            + Crea "
                            {editIngredientSearch.trim() || "Nuovo ingrediente"}
                            "
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="ingredient-selected-head">
                  <strong>
                    Ingredienti selezionati ({editItemIngredientIds.length})
                  </strong>
                </div>
                <div className="chip-wrap selected-chip-preview">
                  {editItemIngredientIds.map((ingredientId) => {
                    const ingredient = ingredientMap[ingredientId];
                    if (!ingredient) return null;
                    return (
                      <button
                        type="button"
                        className="ingredient-chip ordered-chip"
                        key={ingredientId}
                        draggable
                        onDragStart={() => {
                          setDraggingEditIngredientId(ingredientId);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!draggingEditIngredientId) return;
                          setEditItemIngredientIds((prev) =>
                            reorderIds(
                              prev,
                              draggingEditIngredientId,
                              ingredientId,
                            ),
                          );
                          setDraggingEditIngredientId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingEditIngredientId(null);
                        }}
                        onClick={() => {
                          setEditItemIngredientIds((prev) =>
                            prev.filter((id) => id !== ingredientId),
                          );
                        }}
                        title="Trascina per riordinare, clicca per rimuovere"
                      >
                        <span aria-hidden>✓</span>
                        <span>{ingredient.name}</span>
                        <span aria-hidden>✕</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni rilevati</strong>
                </div>
                <div className="chip-wrap">
                  {editDetectedAllergenKeys.length > 0 ? (
                    editDetectedAllergenKeys.map((key) => (
                      <span
                        className="allergen-chip"
                        key={`edit-detected-${key}`}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={key} />
                        </span>
                        <span>{allergenMap[key]?.label ?? key}</span>
                      </span>
                    ))
                  ) : (
                    <span className="section-subtitle">
                      Nessun allergene rilevato
                    </span>
                  )}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni extra</strong>
                </div>
                <div className="allergen-picker compact">
                  {editSelectableExtraAllergens.map((allergen) => {
                    const active = editItemAllergens.includes(allergen.key);
                    return (
                      <button
                        key={allergen.key}
                        type="button"
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setEditItemAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div>
                <input
                  id="edit-item-image-input"
                  type="file"
                  accept="image/*"
                  className="input-hidden-file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    setEditImageFile(file);
                  }}
                />
                <label
                  htmlFor="edit-item-image-input"
                  className="admin-file-btn"
                >
                  Cambia immagine
                </label>
                {editImageFile ? (
                  <p className="section-subtitle">{editImageFile.name}</p>
                ) : null}
              </div>

              <div className="admin-preview-box">
                <img
                  src={
                    editImagePreview ||
                    editingItem.immagine ||
                    "assets/logo1.png"
                  }
                  alt="Anteprima modifica piatto"
                  className="admin-preview-image"
                />
              </div>

              <button
                className="btn-success"
                type="submit"
                disabled={savingId === editingItem.id}
              >
                {savingId === editingItem.id
                  ? "Salvataggio..."
                  : "Salva modifiche"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showQuickIngredientCreate ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal ingredient-quick-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Crea ingrediente veloce"
          >
            <div className="admin-modal-head">
              <h3>Crea ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowQuickIngredientCreate(false);
                }}
                aria-label="Chiudi creazione ingrediente veloce"
              >
                ×
              </button>
            </div>

            <div className="booking-form">
              <label>
                Nome
                <input
                  value={quickIngredientName}
                  onChange={(event) => {
                    setQuickIngredientName(event.currentTarget.value);
                  }}
                  placeholder="Es. Pistacchio"
                />
              </label>

              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = quickIngredientAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setQuickIngredientAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="admin-menu-toolbar minimal-right">
                <button
                  type="button"
                  className="admin-mini-btn"
                  onClick={() => {
                    setShowQuickIngredientCreate(false);
                  }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn-success"
                  disabled={busy}
                  onClick={() => {
                    void saveQuickIngredient();
                  }}
                >
                  {busy ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
