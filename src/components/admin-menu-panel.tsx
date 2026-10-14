"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type WheelEvent,
} from "react";
import { AdminMenuTranslationsPanel } from "@/components/admin-menu-translations-panel";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { createMenuChangeWatcher } from "@/components/admin-menu/menu-cache";
import type { MenuImageFit } from "@/types/menu-app";
import type {
  AdminMenuItem,
  MenuCategory,
  MenuIngredient,
  AllergenDef,
  ItemToggleUndoToast,
  ImageUploadAnalysis,
} from "@/components/admin-menu/types";
import {
  ALLERGENS,
  DEFAULT_MENU_IMAGE_FIT,
  DEFAULT_MENU_IMAGE,
} from "@/components/admin-menu/constants";
import {
  hasCustomMenuImage,
  getMenuImageMetaFromRaw,
  analyzeImageFile,
  uploadMenuImage,
} from "@/components/admin-menu/images";
import {
  normalizePrice,
  reorderIds,
  toggleInArray,
} from "@/components/admin-menu/helpers";
import {
  normalizeText,
  parseStringArray,
  unique as uniqueInsensitive,
  extractSpiceLevelFromRaw,
} from "@/lib/menu-parsing";
import { MenuPanelHeader } from "@/components/admin-menu/panel-header";
import { MenuDishesView } from "@/components/admin-menu/dishes-view";
import { MenuIngredientsView } from "@/components/admin-menu/ingredients-view";
import { MenuCategoryModal } from "@/components/admin-menu/category-modal";
import { MenuAllergenFiltersModal } from "@/components/admin-menu/allergen-filters-modal";
import { MenuNewIngredientModal } from "@/components/admin-menu/new-ingredient-modal";
import { MenuEditIngredientModal } from "@/components/admin-menu/edit-ingredient-modal";
import { MenuMobileDock } from "@/components/admin-menu/mobile-dock";
import { MenuNewDishModal } from "@/components/admin-menu/new-dish-modal";
import { MenuEditDishModal } from "@/components/admin-menu/edit-dish-modal";
import { MenuQuickIngredientModal } from "@/components/admin-menu/quick-ingredient-modal";
import { MenuReorderOverlay } from "@/components/admin-menu/reorder-overlay";

export function AdminMenuPanel() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemToggleUndoToast, setItemToggleUndoToast] =
    useState<ItemToggleUndoToast | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");

  const [menuSubview, setMenuSubview] = useState<"dishes" | "ingredients" | "translations">(
    "dishes",
  );
  const [activeCategory, setActiveCategory] = useState<string>("");
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);

  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(
    null,
  );
  const [draggingModalCategoryId, setDraggingModalCategoryId] = useState<
    string | null
  >(null);
  const [draggingReorderItemId, setDraggingReorderItemId] = useState<
    string | null
  >(null);
  const [reorderDropTargetId, setReorderDropTargetId] = useState<string | null>(
    null,
  );
  const itemToggleUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showReorderMode, setShowReorderMode] = useState(false);

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
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemSpecial, setNewItemSpecial] = useState(false);
  const [newItemImageFit, setNewItemImageFit] =
    useState<MenuImageFit>(DEFAULT_MENU_IMAGE_FIT);
  const [newItemSpiceLevel, setNewItemSpiceLevel] = useState(0);
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
  const [newImageAnalysis, setNewImageAnalysis] =
    useState<ImageUploadAnalysis | null>(null);
  const [newImageDragActive, setNewImageDragActive] = useState(false);
  const [dishCreatedToast, setDishCreatedToast] = useState<string | null>(null);
  const [newDishActiveTab, setNewDishActiveTab] = useState<
    "identity" | "ingredients" | "image"
  >("identity");
  const [newDishIdentityOpen, setNewDishIdentityOpen] = useState(true);
  const [newDishIngredientsOpen, setNewDishIngredientsOpen] = useState(false);
  const [newDishImageOpen, setNewDishImageOpen] = useState(false);
  const [showNewExtraAllergensPanel, setShowNewExtraAllergensPanel] =
    useState(false);
  const [showMobilePhotoPicker, setShowMobilePhotoPicker] = useState(false);

  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemSpecial, setEditItemSpecial] = useState(false);
  const [editItemImageFit, setEditItemImageFit] =
    useState<MenuImageFit>(DEFAULT_MENU_IMAGE_FIT);
  const [editItemSpiceLevel, setEditItemSpiceLevel] = useState(0);
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
  const [editImageAnalysis, setEditImageAnalysis] =
    useState<ImageUploadAnalysis | null>(null);
  const [editDishActiveTab, setEditDishActiveTab] = useState<
    "identity" | "ingredients" | "image"
  >("identity");
  const [editDishIdentityOpen, setEditDishIdentityOpen] = useState(true);
  const [editDishIngredientsOpen, setEditDishIngredientsOpen] = useState(false);
  const [editDishImageOpen, setEditDishImageOpen] = useState(false);
  const [showEditExtraAllergensPanel, setShowEditExtraAllergensPanel] =
    useState(false);
  const [editImageDragActive, setEditImageDragActive] = useState(false);
  const [showEditMobilePhotoPicker, setShowEditMobilePhotoPicker] =
    useState(false);

  const [showQuickIngredientCreate, setShowQuickIngredientCreate] =
    useState(false);
  const [quickIngredientName, setQuickIngredientName] = useState("");
  const [quickIngredientAllergens, setQuickIngredientAllergens] = useState<
    string[]
  >([]);
  const [quickIngredientTarget, setQuickIngredientTarget] = useState<
    "new" | "edit"
  >("new");
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const newImageCameraInputRef = useRef<HTMLInputElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImageCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showReorderMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowReorderMode(false);
      setReorderDropTargetId(null);
      setDraggingReorderItemId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showReorderMode]);

  useEffect(() => {
    if (!showItemModal && !editingItemId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showItemModal, editingItemId]);

  useEffect(() => {
    const db = getClientDb();
    const watchMenuChanges = createMenuChangeWatcher(db);
    const unsubscribe = onSnapshot(collection(db, "menu_items"), (snapshot) => {
      watchMenuChanges(snapshot);
      const next = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            nome: normalizeText(data.nome ?? data.Nome),
            descrizione: normalizeText(data.descrizione ?? data.Descrizione),
            ingredienti: normalizeText(data.ingredienti ?? data.Ingredienti),
            prezzo: normalizePrice(data.prezzo ?? data.Prezzo) ?? 0,
            categoria: normalizeText(
              (data.categoria ?? data.Categoria) || "Pizze classiche",
            ),
            specialita: Boolean(data.specialita ?? data.special),
            spiceLevel: extractSpiceLevelFromRaw(
              data as Record<string, unknown>,
            ),
            immagine: normalizeText(
              (data.immagine ?? data.Immagine) || DEFAULT_MENU_IMAGE,
            ),
            immagineThumb: normalizeText(
              (data.immagineThumb ?? data.ImmagineThumb ?? data.imageThumb) ||
                (data.immagine ?? data.Immagine) ||
                DEFAULT_MENU_IMAGE,
            ),
            imageFit:
              data.imageFit === "contain" || data.imageFit === "cover"
                ? data.imageFit
                : DEFAULT_MENU_IMAGE_FIT,
            imageMeta: getMenuImageMetaFromRaw(data as Record<string, unknown>),
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
    const watchMenuChanges = createMenuChangeWatcher(db);
    const unsubscribe = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
        watchMenuChanges(snapshot);
        const next = snapshot.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: normalizeText(data.name ?? data.nome),
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
    const watchMenuChanges = createMenuChangeWatcher(db);
    const unsubscribe = onSnapshot(
      collection(db, "menu_ingredients"),
      (snapshot) => {
        watchMenuChanges(snapshot);
        const next = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              name: normalizeText(data.name ?? data.nome),
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
          .sort((a, b) => a.name.localeCompare(b.name, "it"));

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

  // Gli stati che dipendono da altri si sistemano durante il render (quando
  // la dipendenza cambia) invece che in un effetto: niente render doppio.

  // Categoria attiva sempre tra quelle esistenti.
  const activeCategoryExists = visibleCategories.some(
    (entry) => entry.toLowerCase() === activeCategory.toLowerCase(),
  );
  const fallbackActiveCategory = visibleCategories[0] ?? "";
  if (!activeCategoryExists && activeCategory !== fallbackActiveCategory) {
    setActiveCategory(fallbackActiveCategory);
  }

  // Nuovo piatto: categoria iniziale = quella aperta, o la prima visibile.
  if (showItemModal && !newItemCategory) {
    const defaultNewItemCategory =
      activeCategory ||
      categories.find((category) => category.visible)?.name ||
      categoryNames[0] ||
      "";
    if (defaultNewItemCategory) setNewItemCategory(defaultNewItemCategory);
  }

  // Chiusura delle finestre piatto: azzera ricerca e trascinamento ingredienti.
  const [prevShowItemModal, setPrevShowItemModal] = useState(showItemModal);
  if (prevShowItemModal !== showItemModal) {
    setPrevShowItemModal(showItemModal);
    if (!showItemModal) {
      setShowNewIngredientResults(false);
      setNewIngredientSearch("");
      setDraggingNewIngredientId(null);
    }
  }

  const [prevEditingItemId, setPrevEditingItemId] = useState(editingItemId);
  if (prevEditingItemId !== editingItemId) {
    setPrevEditingItemId(editingItemId);
    if (!editingItemId) {
      setShowEditIngredientResults(false);
      setEditIngredientSearch("");
      setDraggingEditIngredientId(null);
    }
  }

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
    let result = ingredients;

    if (selectedAllergenFilters.length > 0) {
      result = result.filter((ingredient) =>
        ingredient.allergeni.some((key) =>
          selectedAllergenFilters.includes(key),
        ),
      );
    }

    const query = ingredientSearch.trim().toLowerCase();

    if (query) {
      result = result.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(query),
      );
    }

    return result;
  }, [ingredients, selectedAllergenFilters, ingredientSearch]);

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

  const newIngredientExactMatch = useMemo(() => {
    const query = newIngredientSearch.trim().toLowerCase();
    if (!query) return null;
    return (
      ingredients.find(
        (ingredient) => ingredient.name.toLowerCase() === query,
      ) ?? null
    );
  }, [ingredients, newIngredientSearch]);

  const filteredEditIngredientOptions = useMemo(() => {
    const query = editIngredientSearch.trim().toLowerCase();
    if (!query) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query),
    );
  }, [ingredients, editIngredientSearch]);

  const editIngredientExactMatch = useMemo(() => {
    const query = editIngredientSearch.trim().toLowerCase();
    if (!query) return null;
    return (
      ingredients.find(
        (ingredient) => ingredient.name.toLowerCase() === query,
      ) ?? null
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
  const hasNewImage = Boolean(newImagePreview);

  const editImagePreview = useMemo(() => {
    if (!editImageFile) return "";
    return URL.createObjectURL(editImageFile);
  }, [editImageFile]);
  const editItemHasSavedImage = editingItem
    ? hasCustomMenuImage(editingItem.immagine)
    : false;
  const hasEditImage = Boolean(editImagePreview) || editItemHasSavedImage;
  const editingItemMeta = editingItem?.imageMeta;

  const onNewImageChange = async (file: File | null) => {
    setNewImageFile(file);
    setNewImageDragActive(false);
    setShowMobilePhotoPicker(false);
    if (!file) {
      setNewImageAnalysis(null);
      return;
    }
    try {
      setError(null);
      setNewImageAnalysis(await analyzeImageFile(file));
    } catch {
      setNewImageAnalysis(null);
      setError("Impossibile leggere i dettagli dell'immagine selezionata.");
    }
  };

  const onEditImageChange = async (file: File | null) => {
    setEditImageFile(file);
    setEditImageDragActive(false);
    setShowEditMobilePhotoPicker(false);
    if (!file) {
      setEditImageAnalysis(null);
      return;
    }
    try {
      setError(null);
      setEditImageAnalysis(await analyzeImageFile(file));
    } catch {
      setEditImageAnalysis(null);
      setError("Impossibile leggere i dettagli dell'immagine selezionata.");
    }
  };

  const clearItemToggleUndoTimer = () => {
    if (itemToggleUndoTimerRef.current) {
      clearTimeout(itemToggleUndoTimerRef.current);
      itemToggleUndoTimerRef.current = null;
    }
  };

  const dismissItemToggleUndoToast = () => {
    clearItemToggleUndoTimer();
    setItemToggleUndoToast(null);
  };

  const showItemToggleUndoToast = (toast: ItemToggleUndoToast) => {
    clearItemToggleUndoTimer();
    setItemToggleUndoToast(toast);
    itemToggleUndoTimerRef.current = setTimeout(() => {
      setItemToggleUndoToast(null);
      itemToggleUndoTimerRef.current = null;
    }, 5000);
  };

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

  useEffect(() => {
    return () => {
      clearItemToggleUndoTimer();
    };
  }, []);

  useEffect(() => {
    if (!dishCreatedToast) return;

    const timer = window.setTimeout(() => {
      setDishCreatedToast(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [dishCreatedToast]);

  // Cambio scheda: apre solo la sezione corrispondente.
  const [prevNewDishActiveTab, setPrevNewDishActiveTab] =
    useState(newDishActiveTab);
  if (prevNewDishActiveTab !== newDishActiveTab) {
    setPrevNewDishActiveTab(newDishActiveTab);
    setNewDishIdentityOpen(newDishActiveTab === "identity");
    setNewDishIngredientsOpen(newDishActiveTab === "ingredients");
    setNewDishImageOpen(newDishActiveTab === "image");
  }

  const [prevEditDishActiveTab, setPrevEditDishActiveTab] =
    useState(editDishActiveTab);
  if (prevEditDishActiveTab !== editDishActiveTab) {
    setPrevEditDishActiveTab(editDishActiveTab);
    setEditDishIdentityOpen(editDishActiveTab === "identity");
    setEditDishIngredientsOpen(editDishActiveTab === "ingredients");
    setEditDishImageOpen(editDishActiveTab === "image");
  }

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
    target: "new" | "edit",
  ): "added" | "create" | "noop" => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return "noop";

    const exact = ingredients.find(
      (ingredient) => ingredient.name.toLowerCase() === normalized,
    );
    if (!exact) {
      openQuickCreateIngredient(query, target);
      return "create";
    }

    if (selectedIds.includes(exact.id)) return "noop";

    setSelectedIds((prev) => [...prev, exact.id]);
    return "added";
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
    const name = normalizeText(categoryDrafts[categoryId]);
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
      setError("Prezzo non valido. Usa solo numeri, es. 8,50.");
      return;
    }

    const ingredientIds = uniqueInsensitive(newItemIngredientIds);

    try {
      const db = getClientDb();
      await ensureCategoryExists(categoria);
      const uploaded = newImageFile ? await uploadMenuImage(newImageFile) : null;
      const uploadedImage = uploaded?.imageUrl ?? DEFAULT_MENU_IMAGE;
      const uploadedThumb = uploaded?.thumbUrl ?? uploadedImage;

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
        descrizione: newItemDescription.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria,
        specialita: newItemSpecial,
        special: newItemSpecial,
        piccantezza: newItemSpiceLevel,
        spiceLevel: newItemSpiceLevel,
        immagine: uploadedImage,
        immagineThumb: uploadedThumb,
        imageFit: newItemImageFit,
        imageOriginalWidth: uploaded?.meta.originalWidth ?? null,
        imageOriginalHeight: uploaded?.meta.originalHeight ?? null,
        imageOriginalFileSize: uploaded?.meta.originalFileSize ?? null,
        imageOptimizedFileSize: uploaded?.meta.optimizedFileSize ?? null,
        imageQualityTier: uploaded?.meta.qualityTier ?? null,
        ordine: currentCategoryItems.length,
        ingredientIds,
        allergeni,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setNewItemName("");
      setNewItemDescription("");
      setNewItemPrice("");
      setNewItemCategory(categoria);
      setNewItemSpecial(false);
      setNewItemImageFit(DEFAULT_MENU_IMAGE_FIT);
      setNewItemSpiceLevel(0);
      setNewItemIngredientIds([]);
      setNewItemAllergens([]);
      setNewImageFile(null);
      setNewImageAnalysis(null);
      setNewImageDragActive(false);
      setShowItemModal(false);
      setFeedback("Piatto aggiunto.");
      setDishCreatedToast("Piatto aggiunto");
    } catch {
      setError("Errore durante il salvataggio del piatto.");
    } finally {
      setBusy(false);
    }
  };

  const openEditItem = (item: AdminMenuItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.nome);
    setEditItemDescription(item.descrizione ?? "");
    setEditItemPrice(String(item.prezzo));
    setEditItemCategory(item.categoria);
    setEditItemSpecial(item.specialita ?? false);
    setEditItemImageFit(item.imageFit ?? DEFAULT_MENU_IMAGE_FIT);
    setEditItemSpiceLevel(item.spiceLevel ?? 0);
    setEditItemIngredientIds(item.ingredientIds);
    const detected = inferAllergensFromIngredientIds(item.ingredientIds);
    setEditItemAllergens(
      item.allergeni.filter((key) => !detected.includes(key)),
    );
    setShowEditIngredientResults(false);
    setEditIngredientSearch("");
    setDraggingEditIngredientId(null);
    setEditDishActiveTab("identity");
    setShowEditExtraAllergensPanel(false);
    setShowEditMobilePhotoPicker(false);
    setEditImageDragActive(false);
    setEditImageFile(null);
    setEditImageAnalysis(null);
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

    setSavingId(editingItemId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const uploaded = editImageFile ? await uploadMenuImage(editImageFile) : null;
      const uploadedImage =
        uploaded?.imageUrl || editingItem.immagine || DEFAULT_MENU_IMAGE;
      const uploadedThumb =
        uploaded?.thumbUrl ??
        editingItem.immagineThumb ??
        editingItem.immagine ??
        DEFAULT_MENU_IMAGE;

      const inferredAllergens = inferAllergensFromIngredientIds(ingredientIds);
      const allergeni = uniqueInsensitive([
        ...inferredAllergens,
        ...editItemAllergens,
      ]);
      const ingredientiText = buildIngredientText(ingredientIds);

      await updateDoc(doc(db, "menu_items", editingItemId), {
        nome: editItemName.trim(),
        descrizione: editItemDescription.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria: editItemCategory.trim(),
        specialita: editItemSpecial,
        special: editItemSpecial,
        piccantezza: editItemSpiceLevel,
        spiceLevel: editItemSpiceLevel,
        immagine: uploadedImage,
        immagineThumb: uploadedThumb,
        imageFit: editItemImageFit,
        imageOriginalWidth:
          uploaded?.meta.originalWidth ??
          editingItem.imageMeta?.originalWidth ??
          null,
        imageOriginalHeight:
          uploaded?.meta.originalHeight ??
          editingItem.imageMeta?.originalHeight ??
          null,
        imageOriginalFileSize:
          uploaded?.meta.originalFileSize ??
          editingItem.imageMeta?.originalFileSize ??
          null,
        imageOptimizedFileSize:
          uploaded?.meta.optimizedFileSize ??
          editingItem.imageMeta?.optimizedFileSize ??
          null,
        imageQualityTier:
          uploaded?.meta.qualityTier ??
          editingItem.imageMeta?.qualityTier ??
          null,
        ingredientIds,
        allergeni,
        updatedAt: new Date().toISOString(),
      });

      setEditingItemId(null);
      setEditImageFile(null);
      setEditImageAnalysis(null);
      setEditItemSpecial(false);
      setEditItemImageFit(DEFAULT_MENU_IMAGE_FIT);
      setEditItemSpiceLevel(0);
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
      const nextVisible = !item.visible;
      await updateDoc(doc(db, "menu_items", item.id), {
        visible: nextVisible,
        updatedAt: new Date().toISOString(),
      });
      showItemToggleUndoToast({
        action: "visibility",
        itemId: item.id,
        itemName: item.nome,
        nextValue: nextVisible,
        message: nextVisible
          ? `${item.nome} e visibile nel menu.`
          : `${item.nome} e nascosto nel menu.`,
      });
    } catch {
      setError("Errore durante aggiornamento visibilita.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleItemSpecialty = async (item: AdminMenuItem) => {
    setSavingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const nextSpecial = !item.specialita;
      await updateDoc(doc(db, "menu_items", item.id), {
        specialita: nextSpecial,
        special: nextSpecial,
        updatedAt: new Date().toISOString(),
      });
      showItemToggleUndoToast({
        action: "specialty",
        itemId: item.id,
        itemName: item.nome,
        nextValue: nextSpecial,
        message: nextSpecial
          ? `${item.nome} e in evidenza in homepage.`
          : `${item.nome} non e piu in evidenza.`,
      });
    } catch {
      setError("Errore durante aggiornamento stella.");
    } finally {
      setSavingId(null);
    }
  };

  const undoItemToggle = async () => {
    if (!itemToggleUndoToast) return;

    const toast = itemToggleUndoToast;
    dismissItemToggleUndoToast();
    setSavingId(toast.itemId);
    setError(null);
    setFeedback(null);

    try {
      const db = getClientDb();
      if (toast.action === "visibility") {
        await updateDoc(doc(db, "menu_items", toast.itemId), {
          visible: !toast.nextValue,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(doc(db, "menu_items", toast.itemId), {
          specialita: !toast.nextValue,
          special: !toast.nextValue,
          updatedAt: new Date().toISOString(),
        });
      }
      setFeedback(`Modifica annullata per ${toast.itemName}.`);
    } catch {
      setError("Errore durante annullamento modifica.");
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

  const moveItemByStep = async (itemId: string, step: -1 | 1) => {
    const currentIds = visibleItems.map((entry) => entry.id);
    const currentIndex = currentIds.indexOf(itemId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const targetId = currentIds[targetIndex];
    await reorderCategoryItems(itemId, targetId);
  };

  const moveCategoryByStep = async (categoryId: string, step: -1 | 1) => {
    const currentIds = categories.map((entry) => entry.id);
    const currentIndex = currentIds.indexOf(categoryId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const targetId = currentIds[targetIndex];
    await reorderCategories(categoryId, targetId);
  };

  const onCategoryScrollWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = categoryScrollRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (container.scrollWidth <= container.clientWidth) return;

    event.preventDefault();
    container.scrollBy({ left: event.deltaY, behavior: "auto" });
  };

  const openCategoryManager = () => {
    setShowCategoryModal(true);
  };

  const openNewDishModal = () => {
    if (activeCategory) {
      setNewItemCategory(activeCategory);
    }
    setNewDishActiveTab("identity");
    setShowNewExtraAllergensPanel(false);
    setShowMobilePhotoPicker(false);
    setShowItemModal(true);
  };

  const openReorderModal = () => {
    setShowReorderMode(true);
  };

  return (
    <section
      className={
        menuSubview === "dishes"
          ? "admin-shell admin-shell-menu-dishes"
          : "admin-shell"
      }
    >
      {feedback ? <p className="success-text">{feedback}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <p className="section-subtitle">Caricamento menu remoto...</p>
      ) : null}

      {itemToggleUndoToast ? (
        <div className="admin-action-toast" role="status" aria-live="polite">
          <p>{itemToggleUndoToast.message}</p>
          <div className="admin-action-toast-actions">
            <button type="button" onClick={() => void undoItemToggle()}>
              Annulla
            </button>
            <button
              type="button"
              className="ghost"
              onClick={dismissItemToggleUndoToast}
              aria-label="Chiudi notifica"
            >
              Chiudi
            </button>
          </div>
        </div>
      ) : null}

      {dishCreatedToast ? (
        <div
          className="admin-action-toast admin-action-toast-success"
          role="status"
          aria-live="polite"
        >
          <p>{dishCreatedToast}</p>
        </div>
      ) : null}

      <MenuPanelHeader
        activeCategory={activeCategory}
        categories={categories}
        categoryScrollRef={categoryScrollRef}
        categoryVisibilityByName={categoryVisibilityByName}
        draggingCategoryId={draggingCategoryId}
        fabOpen={fabOpen}
        ingredientSearch={ingredientSearch}
        menuSubview={menuSubview}
        onCategoryScrollWheel={onCategoryScrollWheel}
        openCategoryManager={openCategoryManager}
        openNewDishModal={openNewDishModal}
        openReorderModal={openReorderModal}
        reorderCategories={reorderCategories}
        setActiveCategory={setActiveCategory}
        setDraggingCategoryId={setDraggingCategoryId}
        setFabOpen={setFabOpen}
        setIngredientSearch={setIngredientSearch}
        setMenuSubview={setMenuSubview}
        setShowAllergenFilters={setShowAllergenFilters}
        setShowIngredientModal={setShowIngredientModal}
        visibleCategories={visibleCategories}
        visibleItems={visibleItems}
      />

      {menuSubview === "translations" ? <AdminMenuTranslationsPanel /> : null}

      {menuSubview === "dishes" ? (
        <MenuDishesView
          allergenMap={allergenMap}
          openEditItem={openEditItem}
          removeItem={removeItem}
          savingId={savingId}
          toggleItemSpecialty={toggleItemSpecialty}
          toggleItemVisibility={toggleItemVisibility}
          visibleItems={visibleItems}
        />
      ) : null}

      {menuSubview === "ingredients" ? (
        <MenuIngredientsView
          allergenMap={allergenMap}
          filteredIngredients={filteredIngredients}
          openIngredientEdit={openIngredientEdit}
          removeIngredient={removeIngredient}
          savingId={savingId}
        />
      ) : null}

      {showCategoryModal ? (
        <MenuCategoryModal
          addCategory={addCategory}
          busy={busy}
          categories={categories}
          categoryDrafts={categoryDrafts}
          draggingModalCategoryId={draggingModalCategoryId}
          moveCategoryByStep={moveCategoryByStep}
          newCategoryName={newCategoryName}
          removeCategory={removeCategory}
          renameCategory={renameCategory}
          reorderCategories={reorderCategories}
          savingId={savingId}
          setCategoryDrafts={setCategoryDrafts}
          setDraggingModalCategoryId={setDraggingModalCategoryId}
          setNewCategoryName={setNewCategoryName}
          setShowCategoryModal={setShowCategoryModal}
          toggleCategoryVisibility={toggleCategoryVisibility}
        />
      ) : null}

      {showAllergenFilters ? (
        <MenuAllergenFiltersModal
          selectedAllergenFilters={selectedAllergenFilters}
          setSelectedAllergenFilters={setSelectedAllergenFilters}
          setShowAllergenFilters={setShowAllergenFilters}
        />
      ) : null}

      {showIngredientModal ? (
        <MenuNewIngredientModal
          busy={busy}
          newIngredientAllergens={newIngredientAllergens}
          newIngredientName={newIngredientName}
          saveNewIngredient={saveNewIngredient}
          setNewIngredientAllergens={setNewIngredientAllergens}
          setNewIngredientName={setNewIngredientName}
          setShowIngredientModal={setShowIngredientModal}
        />
      ) : null}

      {editingIngredientId ? (
        <MenuEditIngredientModal
          editingIngredientId={editingIngredientId}
          ingredientEditAllergens={ingredientEditAllergens}
          ingredientEditName={ingredientEditName}
          saveIngredientEdit={saveIngredientEdit}
          savingId={savingId}
          setEditingIngredientId={setEditingIngredientId}
          setIngredientEditAllergens={setIngredientEditAllergens}
          setIngredientEditName={setIngredientEditName}
        />
      ) : null}

      {menuSubview === "dishes" ? (
        <MenuMobileDock
          activeCategory={activeCategory}
          openCategoryManager={openCategoryManager}
          openNewDishModal={openNewDishModal}
          openReorderModal={openReorderModal}
          visibleItems={visibleItems}
        />
      ) : null}

      {showItemModal ? (
        <MenuNewDishModal
          addIngredientFromQuery={addIngredientFromQuery}
          allergenMap={allergenMap}
          busy={busy}
          createItem={createItem}
          draggingNewIngredientId={draggingNewIngredientId}
          filteredNewIngredientOptions={filteredNewIngredientOptions}
          hasNewImage={hasNewImage}
          ingredientMap={ingredientMap}
          newDetectedAllergenKeys={newDetectedAllergenKeys}
          newDishActiveTab={newDishActiveTab}
          newDishIdentityOpen={newDishIdentityOpen}
          newDishImageOpen={newDishImageOpen}
          newDishIngredientsOpen={newDishIngredientsOpen}
          newImageAnalysis={newImageAnalysis}
          newImageCameraInputRef={newImageCameraInputRef}
          newImageDragActive={newImageDragActive}
          newImageInputRef={newImageInputRef}
          newIngredientExactMatch={newIngredientExactMatch}
          newIngredientSearch={newIngredientSearch}
          newItemAllergens={newItemAllergens}
          newItemCategory={newItemCategory}
          newItemDescription={newItemDescription}
          newItemImageFit={newItemImageFit}
          newItemIngredientIds={newItemIngredientIds}
          newItemName={newItemName}
          newItemPrice={newItemPrice}
          newItemSpiceLevel={newItemSpiceLevel}
          newSelectableExtraAllergens={newSelectableExtraAllergens}
          onNewImageChange={onNewImageChange}
          openQuickCreateIngredient={openQuickCreateIngredient}
          selectableCategories={selectableCategories}
          setDraggingNewIngredientId={setDraggingNewIngredientId}
          setNewDishActiveTab={setNewDishActiveTab}
          setNewDishIdentityOpen={setNewDishIdentityOpen}
          setNewDishImageOpen={setNewDishImageOpen}
          setNewDishIngredientsOpen={setNewDishIngredientsOpen}
          setNewImageDragActive={setNewImageDragActive}
          setNewIngredientSearch={setNewIngredientSearch}
          setNewItemAllergens={setNewItemAllergens}
          setNewItemCategory={setNewItemCategory}
          setNewItemDescription={setNewItemDescription}
          setNewItemImageFit={setNewItemImageFit}
          setNewItemIngredientIds={setNewItemIngredientIds}
          setNewItemName={setNewItemName}
          setNewItemPrice={setNewItemPrice}
          setNewItemSpiceLevel={setNewItemSpiceLevel}
          setShowItemModal={setShowItemModal}
          setShowMobilePhotoPicker={setShowMobilePhotoPicker}
          setShowNewExtraAllergensPanel={setShowNewExtraAllergensPanel}
          setShowNewIngredientResults={setShowNewIngredientResults}
          showMobilePhotoPicker={showMobilePhotoPicker}
          showNewExtraAllergensPanel={showNewExtraAllergensPanel}
          showNewIngredientResults={showNewIngredientResults}
        />
      ) : null}

      {editingItem ? (
        <MenuEditDishModal
          addIngredientFromQuery={addIngredientFromQuery}
          allergenMap={allergenMap}
          draggingEditIngredientId={draggingEditIngredientId}
          editDetectedAllergenKeys={editDetectedAllergenKeys}
          editDishActiveTab={editDishActiveTab}
          editDishIdentityOpen={editDishIdentityOpen}
          editDishImageOpen={editDishImageOpen}
          editDishIngredientsOpen={editDishIngredientsOpen}
          editImageAnalysis={editImageAnalysis}
          editImageCameraInputRef={editImageCameraInputRef}
          editImageDragActive={editImageDragActive}
          editImageInputRef={editImageInputRef}
          editImagePreview={editImagePreview}
          editingItem={editingItem}
          editingItemMeta={editingItemMeta}
          editIngredientExactMatch={editIngredientExactMatch}
          editIngredientSearch={editIngredientSearch}
          editItemAllergens={editItemAllergens}
          editItemCategory={editItemCategory}
          editItemDescription={editItemDescription}
          editItemImageFit={editItemImageFit}
          editItemIngredientIds={editItemIngredientIds}
          editItemName={editItemName}
          editItemPrice={editItemPrice}
          editItemSpecial={editItemSpecial}
          editItemSpiceLevel={editItemSpiceLevel}
          editSelectableExtraAllergens={editSelectableExtraAllergens}
          filteredEditIngredientOptions={filteredEditIngredientOptions}
          hasEditImage={hasEditImage}
          ingredientMap={ingredientMap}
          onEditImageChange={onEditImageChange}
          openQuickCreateIngredient={openQuickCreateIngredient}
          saveEditedItem={saveEditedItem}
          savingId={savingId}
          selectableCategories={selectableCategories}
          setDraggingEditIngredientId={setDraggingEditIngredientId}
          setEditDishActiveTab={setEditDishActiveTab}
          setEditDishIdentityOpen={setEditDishIdentityOpen}
          setEditDishImageOpen={setEditDishImageOpen}
          setEditDishIngredientsOpen={setEditDishIngredientsOpen}
          setEditImageDragActive={setEditImageDragActive}
          setEditingItemId={setEditingItemId}
          setEditIngredientSearch={setEditIngredientSearch}
          setEditItemAllergens={setEditItemAllergens}
          setEditItemCategory={setEditItemCategory}
          setEditItemDescription={setEditItemDescription}
          setEditItemImageFit={setEditItemImageFit}
          setEditItemIngredientIds={setEditItemIngredientIds}
          setEditItemName={setEditItemName}
          setEditItemPrice={setEditItemPrice}
          setEditItemSpecial={setEditItemSpecial}
          setEditItemSpiceLevel={setEditItemSpiceLevel}
          setShowEditExtraAllergensPanel={setShowEditExtraAllergensPanel}
          setShowEditIngredientResults={setShowEditIngredientResults}
          setShowEditMobilePhotoPicker={setShowEditMobilePhotoPicker}
          showEditExtraAllergensPanel={showEditExtraAllergensPanel}
          showEditIngredientResults={showEditIngredientResults}
          showEditMobilePhotoPicker={showEditMobilePhotoPicker}
        />
      ) : null}

      {showQuickIngredientCreate ? (
        <MenuQuickIngredientModal
          busy={busy}
          quickIngredientAllergens={quickIngredientAllergens}
          quickIngredientName={quickIngredientName}
          saveQuickIngredient={saveQuickIngredient}
          setQuickIngredientAllergens={setQuickIngredientAllergens}
          setQuickIngredientName={setQuickIngredientName}
          setShowQuickIngredientCreate={setShowQuickIngredientCreate}
        />
      ) : null}

      {showReorderMode ? (
        <MenuReorderOverlay
          activeCategory={activeCategory}
          busy={busy}
          draggingReorderItemId={draggingReorderItemId}
          moveItemByStep={moveItemByStep}
          reorderCategoryItems={reorderCategoryItems}
          reorderDropTargetId={reorderDropTargetId}
          setDraggingReorderItemId={setDraggingReorderItemId}
          setReorderDropTargetId={setReorderDropTargetId}
          setShowReorderMode={setShowReorderMode}
          visibleItems={visibleItems}
        />
      ) : null}
    </section>
  );
}
