"use client";

import { MENU_FAMILIES, menuFamily } from "@/lib/bo/menuFamily";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BOFrame } from "../BOFrame";
import { SearchablePicker } from "../SearchablePicker";
import { moneyLbp, moneyUsd, pct } from "../format";
import { downloadProductionRecipePdf } from "../downloadProductionRecipePdf";
import { RecipePhotoEditor } from "./RecipePhotoEditor";

type Row = Record<string, any>;

const EMPTY_ITEM = {
  name: "",
  menu_category_id: "",
  cover_section_id: "",
  recipe_id: "",
  recipe_factor: "1",
  sp_usd: "",
  active: true,
};

const EMPTY_LINE = {
  section: "primary",
  line_type: "ingredient",
  ingredient_id: "",
  sub_recipe_id: "",
  sub_basis: "unit",
  sub_cost_basis: "ingredients",
  utility_id: "",
  qty: "",
  factor: "1",
  fixed_price: "",
  fixed_currency: "LBP",
  in_yield: true,
  note: "",
  needs_review: false,
};

function asNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function MenuClient() {
  const [menuData, setMenuData] = useState<any>(null);
  const [recipeData, setRecipeData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("visible");
  const [sortKey, setSortKey] = useState("name");
  const [sortAscending, setSortAscending] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<any>({ ...EMPTY_ITEM });
  const [recipeDraft, setRecipeDraft] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState<Row | null>(null);
  const [moveKind, setMoveKind] = useState<"prep" | "sauce">("prep");
  const [moveBusy, setMoveBusy] = useState(false);
  const [newRecipePickerOpen, setNewRecipePickerOpen] = useState(false);
  const [newRecipeSearch, setNewRecipeSearch] = useState("");
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const selectionAnchor = useRef<number | null>(null);
  const [photoIds, setPhotoIds] = useState<Set<number>>(new Set());
  const [photoPreview, setPhotoPreview] = useState<{ name: string; url: string } | null>(null);
  const [photoLoading, setPhotoLoading] = useState<number | null>(null);
  async function refreshPhotoIds(rows?: Row[]) {
    const items: Row[] = rows ?? (menuData?.items ?? menuData?.menuItems ?? []);
    const ids = [...new Set(items.map(row => Number(row.id)).filter(id => Number.isSafeInteger(id) && id > 0))];
    if (!ids.length) { setPhotoIds(new Set()); return; }
    try {
      const found: number[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const response = await fetch("/api/bo/recipe-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids.slice(i, i + 100) }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to check recipe photos.");
        const payload = await response.json();
        found.push(...(payload.ids ?? []).map(Number));
      }
      setPhotoIds(new Set<number>(found));
    } catch {
      // Keep other recipe operations usable if photo availability is inaccessible.
    }
  }
  async function viewPhoto(row: Row) {
    const id = Number(row.id);
    if (!photoIds.has(id) || photoLoading !== null) return;
    setPhotoLoading(id);
    try {
      const res = await fetch(`/api/bo/recipe-photo?item_id=${id}`, { cache: "no-store" });
      const result = await res.json();
      if (!res.ok || !result.url) throw new Error(result.error || "Photo no longer available.");
      setPhotoPreview({ name: String(row.name), url: String(result.url) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open photo.");
      void refreshPhotoIds();
    } finally { setPhotoLoading(null); }
  }

  async function load() {
    setError("");
    try {
      const [menuRes, recipeRes, unitRes] = await Promise.all([
        fetch("/api/bo/menu", { cache: "no-store" }),
        fetch("/api/bo/recipes", { cache: "no-store" }),
        fetch("/api/bo/ingredient-unit-costs", { cache: "no-store" }),
      ]);

      const readJson = async (res: Response, label: string) => {
        const body = await res.text();
        let parsed: any;
        try { parsed = JSON.parse(body); } catch {
          throw new Error(`${label}: received ${res.status} ${res.statusText || ""} instead of JSON. Verify the API route exists and check the Next.js terminal.`);
        }
        if (!res.ok) throw new Error(parsed?.error || `${label}: HTTP ${res.status}`);
        return parsed;
      };

      // Main menu and recipe data should still load if the auxiliary unit-cost
      // route is unavailable. The server costing engine remains the source of truth.
      const [menuJson, recipeJson] = await Promise.all([
        readJson(menuRes, "Menu API"),
        readJson(recipeRes, "Recipes API"),
      ]);
      setMenuData(menuJson);
      setRecipeData(recipeJson);
      void refreshPhotoIds(menuJson?.items ?? menuJson?.menuItems ?? []);

      try {
        const unitJson = await readJson(unitRes, "Ingredient unit costs API");
        setUnitCosts(unitJson?.costs || {});
      } catch (unitError) {
        setUnitCosts({});
        setError(unitError instanceof Error ? unitError.message : "Unable to load ingredient unit costs.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load Recipes.");
    }
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => { if (!open) void refreshPhotoIds(); }, [open]);

  // Open the editor when arriving from Menu Pricing's read-only preview.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id || !menuData || !recipeData) return;
    const item = (menuData?.items ?? menuData?.menuItems ?? []).find((row: Row) => String(row.id) === id);
    if (!item) return;
    startEdit(item);
    window.history.replaceState(null, "", window.location.pathname);
  }, [menuData, recipeData]);


  async function toggleVisibility(row: Row) {
    if (actionBusy !== null) return;
    setActionBusy(Number(row.id)); setError(""); setNotice("");
    try {
      const nextActive = row.active === false;
      const response = await fetch("/api/bo/menu", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id, name: row.name, menu_category_id: row.menu_category_id,
          cover_section_id: row.cover_section_id, recipe_id: row.recipe_id,
          recipe_factor: row.recipe_factor ?? 1, sp_usd: row.sp_usd,
          active: nextActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to update visibility.");
      await load();
      setOpen(false); setNotice(`${row.name} is now ${nextActive ? "visible" : "hidden"} on Menu Pricing.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update visibility."); }
    finally { setActionBusy(null); }
  }

  async function deleteItem(row: Row) {
    if (actionBusy !== null) return;
    if (!window.confirm(`Delete menu item "${row.name}"? This removes it from Recipes and Menu Pricing. The linked production/recipe data will not be deleted.`)) return;
    setActionBusy(Number(row.id)); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/bo/menu?id=${encodeURIComponent(String(row.id))}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Unable to delete menu item.");
      await load(); setOpen(false); setNotice(`${row.name} deleted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete menu item."); }
    finally { setActionBusy(null); }
  }

  async function moveToProduction() {
    if (!moveTarget || moveBusy) return;
    const row = moveTarget;
    setMoveBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/bo/menu/move-to-production", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_item_id: Number(row.id), kind: moveKind }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Unable to move recipe.");
      setMoveTarget(null); setOpen(false); setSelectedIds(prev => prev.filter(id => id !== Number(row.id)));
      await load();
      setNotice(`Moved “${row.name}” to ${moveKind === "sauce" ? "Sauces" : "Prep"}. Its recipe ingredients and costs were preserved.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to move recipe."); }
    finally { setMoveBusy(false); }
  }

  function requestMove(row: Row) {
    setMoveKind("prep"); setMoveTarget(row); setError("");
  }

  function hasFlaggedLines(row: Row) {
    const recipe = (recipeData?.recipes ?? []).find(
      (x: Row) => String(x.id) === String(row.recipe_id),
    );
    return (recipe?.lines ?? []).some((line: Row) => line.needs_review === true);
  }

  async function downloadRecipe(row: Row) {
    const recipe = (recipeData?.recipes ?? []).find((x: Row) => String(x.id) === String(row.recipe_id));
    if (!recipe) { setError(`No linked recipe is available for ${row.name}.`); return; }
    await downloadProductionRecipePdf(recipe, {
      menuItemId: Number(row.id), displayName: String(row.name), ingredients: recipeData?.ingredients ?? [], utilities: recipeData?.utilities ?? [],
      allRecipes: recipeData?.all_recipes ?? [], rate: Number(menuData?.usd_lbp_rate) || 0,
    });
  }

  const categoryGroups = useMemo(() => {
    const categories: Row[] = menuData?.categories ?? [];
    const matching = (menuData?.items ?? []).filter((row: Row) => {
      const needle = search.trim().toLowerCase();
      return (!needle || String(row.name).toLowerCase().includes(needle) || String(row.recipe?.name ?? "").toLowerCase().includes(needle))
        && (categoryFilter === "all" || String(row.menu_category_id ?? "none") === categoryFilter)
        && (visibilityFilter === "all" || (visibilityFilter === "visible" && row.active !== false) || (visibilityFilter === "hidden" && row.active === false) || (visibilityFilter === "review" && hasFlaggedLines(row)));
    });
    const groups = categories.map((category: Row) => ({ id: String(category.id), name: String(category.name),
      items: matching.filter((row: Row) => String(row.menu_category_id) === String(category.id)) }));
    const known = new Set(categories.map((category: Row) => String(category.id)));
    groups.push({ id: "none", name: "Uncategorized", items: matching.filter((row: Row) => !known.has(String(row.menu_category_id))) });
    const sortValue = (r: Row): string | number | null => {
      if (sortKey === "name") return String(r.name ?? "");
      if (sortKey === "profit_usd") return Number(r.gross_profit_lbp ?? 0) / (Number(menuData?.usd_lbp_rate) || 1);
      if (sortKey === "profit_lbp") return r.gross_profit_lbp == null ? null : Number(r.gross_profit_lbp);
      return r[sortKey] == null ? null : Number(r[sortKey]);
    };
    return groups.filter(group => group.items.length > 0).map(group => ({ ...group, items: [...group.items].sort((a: Row, b: Row) => {
      const av = sortValue(a), bv = sortValue(b);
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      const comparison = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv, undefined, {numeric: true, sensitivity: "base"}) : Number(av) - Number(bv);
      return sortAscending ? comparison : -comparison;
    }) }));
  }, [menuData, search, categoryFilter, visibilityFilter, sortKey, sortAscending, recipeData]);

  // Selection is by menu item ID and is independent of category collapse.
  const visibleSelectionIds = categoryGroups.flatMap((group: Row) => group.items.map((item: Row) => Number(item.id)));
  const selectedItems: Row[] = (menuData?.items ?? []).filter((item: Row) => selectedIds.includes(Number(item.id)));
  const allVisibleSelected = visibleSelectionIds.length > 0 && visibleSelectionIds.every(id => selectedIds.includes(id));
  // Shift-click selects the contiguous range in the current visible, sorted table order.
  // Normal clicks become the new selection anchor; Shift-click retains the anchor.
  const selectRow = (id: number, shiftKey: boolean) => {
    const anchor = selectionAnchor.current;
    const from = anchor === null ? -1 : visibleSelectionIds.indexOf(anchor);
    const to = visibleSelectionIds.indexOf(id);
    setSelectedIds(previous => {
      const checked = !previous.includes(id);
      if (shiftKey && from !== -1 && to !== -1) {
        const range = visibleSelectionIds.slice(Math.min(from, to), Math.max(from, to) + 1);
        return checked
          ? [...new Set([...previous, ...range])]
          : previous.filter(value => !range.includes(value));
      }
      return checked ? [...previous, id] : previous.filter(value => value !== id);
    });
    if (!shiftKey || anchor === null || from === -1) selectionAnchor.current = id;
  };
  const toggleGroupSelection = (ids: number[], checked: boolean) =>
    setSelectedIds(previous => checked ? [...new Set([...previous, ...ids])] : previous.filter(id => !ids.includes(id)));

  // Use the same endpoint and payload as the existing single-item action.
  async function updateMenuItem(row: Row, changes: Row) {
    const response = await fetch("/api/bo/menu", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: row.id, name: row.name, menu_category_id: row.menu_category_id,
        cover_section_id: row.cover_section_id, recipe_id: row.recipe_id,
        recipe_factor: row.recipe_factor ?? 1, sp_usd: row.sp_usd,
        active: row.active !== false, ...changes,
      }),
    });
    const body = await response.text();
    let result: Row = {};
    try { result = body ? JSON.parse(body) : {}; } catch { /* show HTTP status */ }
    if (!response.ok || result.ok !== true) throw new Error(result.error || `HTTP ${response.status}`);
  }

  async function runBulk(action: "hide" | "delete" | "category" | "flag" | "unflag") {
    if (bulkBusy || actionBusy !== null || !selectedItems.length) return;
    if (action === "category" && !bulkCategory) { setError("Choose the destination category first."); return; }
    const verb = action === "hide" ? "hide from Menu Pricing" : action === "delete" ? "DELETE" : action === "category" ? "move to the selected category" : action === "flag" ? "flag for review" : "clear review flags for";
    if (!window.confirm(`${verb} ${selectedItems.length} selected recipe(s)?${action === "delete" ? " This deletes the menu items, not their shared recipe definitions." : ""}`)) return;
    setBulkBusy(true); setError(""); setNotice("");
    const succeeded: number[] = [];
    const failures: string[] = [];
    for (const row of selectedItems) {
      try {
        if (action === "hide") await updateMenuItem(row, { active: false });
        if (action === "category") await updateMenuItem(row, { menu_category_id: bulkCategory === "none" ? null : Number(bulkCategory) });
        if (action === "delete") {
          const response = await fetch(`/api/bo/menu?id=${encodeURIComponent(String(row.id))}`, { method: "DELETE" });
          const body = await response.text();
          let result: Row = {};
          try { result = body ? JSON.parse(body) : {}; } catch { /* show HTTP status */ }
          if (!response.ok || result.ok !== true) throw new Error(result.error || `HTTP ${response.status}`);
        }
        if (action === "flag" || action === "unflag") {
          const recipe = (recipeData?.recipes ?? []).find((r: Row) => String(r.id) === String(row.recipe_id));
          const lines: Row[] = recipe?.lines ?? [];
          if (!recipe || !lines.length) throw new Error("No saved recipe lines found");
          // A recipe is flagged when at least one saved line needs review.
          // Clearing review must clear EVERY flagged line, not just the first.
          const targetLines = action === "flag"
            ? (lines.some((line: Row) => line.needs_review === true) ? [] : [lines[0]])
            : lines.filter((line: Row) => line.needs_review === true);
          for (const line of targetLines) {
            if (!line.id) throw new Error("A recipe line has no saved ID");
            const response = await fetch("/api/bo/recipe-review", {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ line_id: line.id, recipe_id: recipe.id, needs_review: action === "flag" }),
            });
            const body = await response.text();
            let result: Row = {};
            try { result = body ? JSON.parse(body) : {}; } catch { /* show HTTP status */ }
            if (!response.ok || result.ok !== true) throw new Error(result.error || `HTTP ${response.status}`);
          }
        }
        succeeded.push(Number(row.id));
      } catch (e) { failures.push(`${row.name}: ${e instanceof Error ? e.message : "Request failed"}`); }
    }
    setSelectedIds(previous => previous.filter(id => !succeeded.includes(id)));
    try { await load(); } catch { /* load already reports errors */ }
    if (failures.length) setError(`${succeeded.length} succeeded; ${failures.length} failed. ${failures.slice(0, 5).join(" | ")}`);
    else setNotice(`${succeeded.length} recipe(s) updated successfully.`);
    setBulkBusy(false);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (menuData?.items ?? []).filter(
      (row: Row) =>
        !q ||
        String(row.name).toLowerCase().includes(q) ||
        String(row.recipe?.name ?? "").toLowerCase().includes(q),
    );
  }, [menuData, search]);

  const searchableMenuItems: Row[] = useMemo(() => {
    const q = newRecipeSearch.trim().toLowerCase();
    return [...(menuData?.items ?? [])]
      .filter((row: Row) => !q || String(row.name ?? "").toLowerCase().includes(q))
      .sort((a: Row, b: Row) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  }, [menuData, newRecipeSearch]);

  const ingredients: Row[] = recipeData?.ingredients ?? [];
  const utilities: Row[] = recipeData?.utilities ?? [];
  // Menu-item titles are authoritative for one-to-one linked menu recipes.
  // Use their current names in linked-recipe pickers and costing rows even if
  // legacy bo_recipes.name or stored line labels have not been updated yet.
  const linkedMenuNames = new Map<string, string[]>();
  for (const item of (menuData?.items ?? menuData?.menuItems ?? []) as Row[]) {
    if (!item.recipe_id || !String(item.name ?? "").trim()) continue;
    const id = String(item.recipe_id);
    linkedMenuNames.set(id, [...(linkedMenuNames.get(id) ?? []), String(item.name).trim()]);
  }
  const allRecipes: Row[] = (recipeData?.all_recipes ?? []).map((recipe: Row) => {
    const names = linkedMenuNames.get(String(recipe.id)) ?? [];
    return { ...recipe, name: names.length === 1 ? names[0] : (recipe.display_name || recipe.name) };
  });

  function buildRecipeDraft(recipe: Row | null, item?: Row) {
    if (!recipe) {
      // Menu items without a linked recipe must still be editable.
      // Persist the new recipe only when Save Changes is pressed.
      setRecipeDraft({
        id: null,
        name: String(item?.name || draft.name || "New recipe"),
        kind: "menu",
        menu_category_id: String(item?.menu_category_id || draft.menu_category_id || ""),
        yield_qty: "1",
        yield_mode: "fixed",
        yield_unit: "POR",
        waste_pct: "0",
        notes: "",
        lines: [],
      });
      return;
    }

    setRecipeDraft({
      id: recipe.id,
      name: recipe.name ?? "",
      kind: recipe.kind ?? "menu",
      menu_category_id: recipe.menu_category_id ? String(recipe.menu_category_id) : "",
      yield_qty: recipe.yield_qty ?? "",
      yield_mode: recipe.yield_mode ?? "fixed",
      yield_unit: recipe.yield_unit ?? "",
      waste_pct: recipe.waste_pct ?? "0",
      notes: recipe.notes ?? "",
      lines: (recipe.lines ?? []).map((line: Row) => ({
        ...EMPTY_LINE,
        ...line,
        ingredient_id: line.ingredient_id ? String(line.ingredient_id) : "",
        sub_recipe_id: line.sub_recipe_id ? String(line.sub_recipe_id) : "",
        sub_cost_basis: "ingredients",
        utility_id: line.utility_id ? String(line.utility_id) : "",
        qty: line.qty ?? "",
        factor: "1", // Legacy hidden factors are retired when this recipe is saved.
        fixed_price: line.fixed_price ?? "",
      })),
    });
  }

  function startEdit(row: Row) {
    setEditing(row);

    const nextDraft = {
      name: row.name ?? "",
      menu_category_id: row.menu_category_id ? String(row.menu_category_id) : "",
      cover_section_id: row.cover_section_id ? String(row.cover_section_id) : "",
      recipe_id: row.recipe_id ? String(row.recipe_id) : "",
      recipe_factor: "1",
      sp_usd: row.sp_usd ?? "",
      active: row.active !== false,
    };

    setDraft(nextDraft);

    const recipe = (recipeData?.recipes ?? []).find(
      (x: Row) => String(x.id) === String(nextDraft.recipe_id),
    ) ?? null;

    buildRecipeDraft(recipe, row);
    setOpen(true);
    setError("");
  }

  function startNewRecipeForItem(row: Row) {
    // Copy the selected item's existing recipe into an independent new draft.
    // Never reuse its recipe id or recipe-line ids; the original remains intact.
    const sourceRecipe = (recipeData?.recipes ?? []).find(
      (recipe: Row) => String(recipe.id) === String(row.recipe_id),
    ) ?? null;

    // Do not silently present an empty recipe when a linked recipe could not
    // be loaded. That risks overwriting a linked item's costing information.
    if (row.recipe_id && !sourceRecipe) {
      setError(`The recipe linked to “${row.name}” was not loaded. Reopen Recipes and try again.`);
      setNewRecipePickerOpen(false);
      return;
    }

    const copyName = `${String(row.name ?? "Recipe").trim()} (Copy)`;
    const nextDraft = {
      name: copyName,
      menu_category_id: row.menu_category_id ? String(row.menu_category_id) : "",
      cover_section_id: row.cover_section_id ? String(row.cover_section_id) : "",
      recipe_id: "",
      recipe_factor: "1",
      sp_usd: row.sp_usd ?? "",
      active: true, // Every newly created recipe is visible on Menu Pricing by default.
    };
    // A copy is a NEW menu item, not an edit of the source item.
    // Clearing the item ID is essential; clearing only recipe_id overwrites the original.
    setEditing({ id: null, name: copyName, active: true });
    setDraft(nextDraft);
    setRecipeDraft({
      id: null,
      name: copyName,
      kind: "menu",
      menu_category_id: nextDraft.menu_category_id,
      yield_qty: sourceRecipe?.yield_qty ?? "1",
      yield_mode: sourceRecipe?.yield_mode ?? "fixed",
      yield_unit: sourceRecipe?.yield_unit ?? "POR",
      waste_pct: sourceRecipe?.waste_pct ?? "0",
      notes: sourceRecipe?.notes ?? "",
      lines: (sourceRecipe?.lines ?? []).map((line: Row) => ({
        ...EMPTY_LINE,
        ...line,
        id: undefined,
        recipe_id: undefined,
        ingredient_id: line.ingredient_id ? String(line.ingredient_id) : "",
        sub_recipe_id: line.sub_recipe_id ? String(line.sub_recipe_id) : "",
        sub_cost_basis: "ingredients",
        utility_id: line.utility_id ? String(line.utility_id) : "",
        qty: line.qty ?? "",
        factor: "1",
        fixed_price: line.fixed_price ?? "",
      })),
    });
    setError("");
    setNewRecipePickerOpen(false);
    setOpen(true);
  }

  function startNewRecipeNamed(name: string) {
    const trimmed = name.trim();
    setEditing({ id: null, name: trimmed, active: true });
    setDraft({ ...EMPTY_ITEM, name: trimmed, menu_category_id: "", active: true });
    setRecipeDraft({
      id: null, name: trimmed || "New recipe", kind: "menu",
      menu_category_id: "", yield_qty: "1", yield_mode: "fixed",
      yield_unit: "POR", waste_pct: "0", notes: "", lines: [],
    });
    setNewRecipePickerOpen(false);
    setOpen(true);
    setError("");
  }

  function changeRecipe(recipeId: string) {
    setDraft({ ...draft, recipe_id: recipeId });

    const recipe = (recipeData?.recipes ?? []).find(
      (x: Row) => String(x.id) === String(recipeId),
    ) ?? null;

    buildRecipeDraft(recipe);
  }

  function addLine(type: "ingredient" | "recipe" | "utility" | "fixed") {
    if (!recipeDraft) return;

    setRecipeDraft({
      ...recipeDraft,
      lines: [
        ...recipeDraft.lines,
        {
          ...EMPTY_LINE,
          line_type: type,
          qty: type === "utility" || type === "recipe" ? "1" : "",
          section: type === "utility" || type === "fixed" ? "utility" : "primary",
        },
      ],
    });
  }

  function updateLine(index: number, patch: Row) {
    if (!recipeDraft) return;

    setRecipeDraft({
      ...recipeDraft,
      lines: recipeDraft.lines.map((line: Row, i: number) =>
        i === index ? { ...line, ...patch } : line,
      ),
    });
  }

  async function toggleReviewFlag(index: number) {
    if (!recipeDraft || saving) return;
    const line = recipeDraft.lines[index];
    if (!line) return;
    const next = line.needs_review !== true;
    // Display the flag immediately. Unsaved lines are persisted by Save Changes.
    updateLine(index, { needs_review: next });
    if (!line.id || !recipeDraft.id) {
      setNotice("Flag set in this draft. Click Save Changes to keep it.");
      return;
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/bo/recipe-review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_id: line.id, recipe_id: recipeDraft.id, needs_review: next }),
      });
      const body = await response.text();
      let payload: any = null;
      try { payload = body ? JSON.parse(body) : null; } catch { /* non-JSON response */ }
      if (!response.ok || payload?.ok !== true || payload?.line?.needs_review !== next) {
        throw new Error(payload?.error || `Review flag could not be saved (HTTP ${response.status}). Verify the recipe-review API and database migration.`);
      }
      // Refresh list badges; keep the current popup and its draft intact.
      const recipeResponse = await fetch("/api/bo/recipes", { cache: "no-store" });
      if (recipeResponse.ok) {
        const updatedRecipes = await recipeResponse.json();
        setRecipeData(updatedRecipes);
      }
    } catch (e) {
      updateLine(index, { needs_review: !next });
      setError(e instanceof Error ? e.message : "Unable to update review flag.");
    }
  }

  function removeLine(index: number) {
    if (!recipeDraft) return;

    setRecipeDraft({
      ...recipeDraft,
      lines: recipeDraft.lines.filter((_: Row, i: number) => i !== index),
    });
  }

  // Independent read-only fallback for ingredient-only prep/sauce costs.
  // Use the complete recipe lines when summary ingredientUnitCost is absent.
  // Never substitute a production's full cost: it could include utilities twice.
  function linkedIngredientUnitCost(recipeId: string, visited: Set<string> = new Set()): number | null {
    if (visited.has(recipeId)) return null;
    const recipe: Row | undefined = (recipeData?.recipes ?? []).find((r: Row) => String(r.id) === recipeId);
    if (!recipe) return null;
    const next = new Set(visited);
    next.add(recipeId);
    const yieldQty = asNumber(recipe.yield_qty);
    const portionYield = yieldQty !== null && yieldQty > 0 ? yieldQty : recipe.kind === "menu" ? 1 : null;
    if (portionYield === null) return null;
    const waste = Math.max(0, Math.min(.99, Number(recipe.waste_pct) || 0));
    const usableYield = portionYield * (1 - waste);
    if (usableYield <= 0) return null;
    let batch = 0;
    for (const row of (recipe.lines ?? []) as Row[]) {
      if (row.line_type === "utility" || row.line_type === "fixed") continue;
      // Imported unresolved lines are excluded from original workbook totals.
      if (row.line_type === "unresolved") continue;
      const qty = asNumber(row.qty);
      if (qty === null) return null;
      let sourceCost: number | null = null;
      if (row.line_type === "ingredient") {
        const ingredient = (recipeData?.ingredients ?? []).find((r: Row) => String(r.id) === String(row.ingredient_id));
        sourceCost = asNumber(unitCosts[String(row.ingredient_id)] ?? ingredient?.unit_cost_lbp);
      } else if (row.line_type === "recipe") {
        const subId = String(row.sub_recipe_id ?? "");
        const unitCost = linkedIngredientUnitCost(subId, next);
        sourceCost = row.sub_basis === "batch"
          ? (unitCost === null ? null : unitCost * (Number((recipeData?.recipes ?? []).find((r: Row) => String(r.id) === subId)?.yield_qty) || 1))
          : unitCost;
      }
      if (sourceCost === null) return null;
      batch += qty * sourceCost;
    }
    return batch / usableYield;
  }

  function sourceMeta(line: Row) {
    if (line.line_type === "ingredient") {
      const source = ingredients.find(
        (x: Row) => String(x.id) === String(line.ingredient_id),
      );
      return {
        name: source?.name ?? "SELECT INGREDIENT",
        unit: source?.consumption_unit || source?.purchase_unit || "—",
        cost: asNumber(unitCosts[String(line.ingredient_id)] ?? source?.unit_cost_lbp),
      };
    }

    if (line.line_type === "utility") {
      const source = utilities.find(
        (x: Row) => String(x.id) === String(line.utility_id),
      );
      return {
        name: source?.name ?? "SELECT UTILITY",
        unit: source?.unit_label || "—",
        cost: asNumber(source?.unit_cost_lbp),
      };
    }

    if (line.line_type === "recipe") {
      const source = allRecipes.find(
        (x: Row) => String(x.id) === String(line.sub_recipe_id),
      );
      // Linked Prep / Sauce costs never include their own utility or fixed costs.
      // The Recipes API supplies these fields from the shared costing engine.
      const fromFullRecipe = (recipeData?.recipes ?? []).find(
        (r: Row) => String(r.id) === String(line.sub_recipe_id),
      );
      const cost = line.sub_basis === "batch"
        ? asNumber(source?.ingredient_batch_cost_lbp ?? source?.costing?.ingredientBatchCost ?? fromFullRecipe?.costing?.ingredientBatchCost)
        : asNumber(source?.ingredient_unit_cost_lbp ?? source?.costing?.ingredientUnitCost ?? fromFullRecipe?.costing?.ingredientUnitCost);
      // If the API summary omits the ingredient-only total, compute it from
      // saved ingredient rows only (never the full production cost).
      const fallbackUnit = cost === null ? linkedIngredientUnitCost(String(line.sub_recipe_id)) : null;
      const resolvedCost = cost ?? (fallbackUnit === null ? null : line.sub_basis === "batch"
        ? fallbackUnit * (Number(fromFullRecipe?.yield_qty ?? source?.saved_yield_qty) || 1)
        : fallbackUnit);
      // A total production batch price cannot substitute for ingredients-only
      // unit cost. Show why a missing ingredient cost cannot yet be calculated.
      const issues: string[] = source?.costing?.issues ?? fromFullRecipe?.costing?.issues ?? [];
      const reason = !source && !fromFullRecipe
        ? "Linked recipe not found in Recipes API"
        : resolvedCost === null && line.sub_basis !== "batch" && !(Number(source?.usable_yield) > 0)
          ? `No usable yield for ${source?.name || "linked recipe"} (recipe ID ${String(line.sub_recipe_id)}; saved yield ${String(source?.saved_yield_qty ?? "empty")}; mode ${String(source?.yield_mode ?? "unknown")}). Set and save Total Yield in Production.`
          : resolvedCost === null ? (`Linked recipe ID ${String(line.sub_recipe_id)}: ` + (issues.join("; ") || "Ingredient-only source cost is unavailable")) : "";

      return {
        name: source?.name ?? "SELECT PREP / SAUCE",
        unit: source?.yield_unit || "—",
        cost: resolvedCost,
        reason,
      };
    }

    if (line.line_type === "fixed") {
      return {
        name: "FIXED COST",
        unit: line.fixed_currency || "LBP",
        cost: asNumber(line.fixed_price),
      };
    }

    return {
      name: "UNRESOLVED",
      unit: "—",
      cost: null,
    };
  }

  function lineTotal(line: Row) {
    const source = sourceMeta(line);
    const qty = asNumber(line.qty);
    if (source.cost === null || qty === null) return null;
    return source.cost * qty;
  }

  const recipeFactor = 1; // No hidden menu-level cost multiplier.
  const recipeLines: Row[] = recipeDraft?.lines ?? [];

  // A source belongs to exactly one section. In particular, PREP / SAUCE
  // lines must not appear in both Ingredients and Utility.
  const ingredientsWithIndex = recipeLines
    .map((line: Row, index: number) => ({ line, index }))
    .filter(({ line }) => line.line_type === "ingredient" || line.line_type === "recipe");

  const utilityWithIndex = recipeLines
    .map((line: Row, index: number) => ({ line, index }))
    .filter(({ line }) => line.line_type === "utility" || line.line_type === "fixed");

  // Legacy workbook rows have a label but no source ID. They must remain
  // visible until a user explicitly repairs or removes them.
  const unresolvedWithIndex = recipeLines
    .map((line: Row, index: number) => ({ line, index }))
    .filter(({ line }) => !["ingredient", "recipe", "utility", "fixed"].includes(String(line.line_type)));

  function repairUnresolved(index: number, type: "ingredient" | "recipe" | "utility" | "fixed") {
    updateLine(index, {
      line_type: type,
      section: type === "utility" || type === "fixed" ? "utility" : "primary",
      ingredient_id: "",
      sub_recipe_id: "",
      utility_id: "",
      fixed_price: "",
      // Preserve original source labels/formulas and notes for reference.
    });
    setError("");
  }

  // Show the entire utility catalog, without modifying the saved recipe.
  // Utilities previously removed from this recipe remain removed until explicitly added.
  const assignedUtilityIds = new Set(
    recipeLines.filter((line: Row) => line.line_type === "utility")
      .map((line: Row) => String(line.utility_id)),
  );
  const availableUtilities = utilities.filter((utility: Row) =>
    !assignedUtilityIds.has(String(utility.id))
  );

  function addSpecificUtility(utilityId: number | string) {
    if (!recipeDraft || assignedUtilityIds.has(String(utilityId))) return;
    setRecipeDraft((previous: any) => previous ? {
      ...previous,
      lines: [...previous.lines, {
        ...EMPTY_LINE,
        section: "utility", line_type: "utility",
        utility_id: String(utilityId), qty: "1", factor: "1",
      }],
    } : previous);
  }

  const liveRecipeCost = recipeLines.reduce((sum, line) => {
    const total = lineTotal(line);
    return sum + (total ?? 0);
  }, 0);

  const yieldQty = asNumber(recipeDraft?.yield_qty);
  const waste = Math.min(0.99, Math.max(0, asNumber(recipeDraft?.waste_pct) ?? 0));
  const usableYield = yieldQty && yieldQty > 0 ? yieldQty * (1 - waste) : null;
  const liveUnitCost =
    usableYield && usableYield > 0 ? liveRecipeCost / usableYield : null;

  // Utility costs are a component of the total recipe cost, not an additional charge.
  const utilityBatchCost = utilityWithIndex.reduce((sum, entry) =>
    sum + (lineTotal(entry.line) ?? 0), 0);
  const utilityCostLbp = usableYield && usableYield > 0
    ? (utilityBatchCost / usableYield) * recipeFactor : null;
  const rate = Number(menuData?.usd_lbp_rate) || 0;
  const displayUsd = (lbp: number | null) =>
    lbp !== null && rate > 0 ? moneyUsd(lbp / rate) : "—";

  const salePriceLbp =
    draft.sp_usd && menuData?.usd_lbp_rate
      ? Number(draft.sp_usd) * Number(menuData.usd_lbp_rate)
      : null;

  const totalCost =
    liveUnitCost !== null ? liveUnitCost * recipeFactor : null;

  const foodCost =
    totalCost !== null && salePriceLbp && salePriceLbp > 0
      ? totalCost / salePriceLbp
      : null;

  const profit =
    totalCost !== null && salePriceLbp !== null
      ? salePriceLbp - totalCost
      : null;

  const margin =
    profit !== null && salePriceLbp && salePriceLbp > 0
      ? profit / salePriceLbp
      : null;

  const ingredientOptions = ingredients.map((x: Row) => ({
    value: String(x.id),
    label: x.name,
  }));

  const utilityOptions = utilities.map((x: Row) => ({
    value: String(x.id),
    label: x.name,
  }));

  const prepRecipeOptions = allRecipes
    .filter((x: Row) => String(x.id) !== String(recipeDraft?.id))
    .map((x: Row) => ({
      value: String(x.id),
      label: x.name,
    }));

  async function saveDishName() {
    const name = String(draft.name ?? "").trim();
    if (!name) { setError("Enter a dish name before saving."); return; }
    const menuItemId = Number(editing?.id);
    if (!menuItemId) {
      setError("For a new menu item, use Save Changes to create it first.");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bo/menu/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: menuItemId, name }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Unable to rename this dish.");
      }
      setEditing((previous: Row | null) => previous ? { ...previous, name } : previous);
      setDraft((previous: any) => ({ ...previous, name }));
      // Keep the open recipe draft in sync; no ingredient rows are modified.
      setRecipeDraft((previous: any) => previous ? { ...previous, name } : previous);
      await load();
      setNotice(`Dish renamed to “${name}”.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to rename dish.");
    } finally {
      setSaving(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!String(draft.name || "").trim()) throw new Error("Enter the recipe/item name before saving.");
      const unresolved = (recipeDraft?.lines ?? []).filter((line: Row) =>
        !["ingredient", "recipe", "utility", "fixed"].includes(String(line.line_type))
      );
      if (unresolved.length) {
        throw new Error(`${unresolved.length} imported unresolved item(s) need attention. In UNRESOLVED ITEMS, link each item to a valid source or explicitly remove it before saving. No rows were deleted.`);
      }
      if (!recipeDraft?.lines?.length && !editing?.id) throw new Error("Add at least one ingredient or utility before saving a new recipe.");
      // Persist the recipe BEFORE creating the menu item. Creating the menu
      // item first used to leave a blank (Copy) item when line saving failed.
      let menuItemId = Number(editing?.id) || null;
      let outgoingRecipe = recipeDraft;
      let outgoingItem: Row = { ...draft, id: menuItemId, recipe_factor: 1 };
      if (recipeDraft && !Number(recipeDraft.id)) {
        if (!recipeDraft.lines.length) {
          throw new Error("Add at least one ingredient, preparation, or utility before saving a new recipe.");
        }
        for (const [index, line] of recipeDraft.lines.entries()) {
          const selected = line.line_type === "ingredient" ? line.ingredient_id
            : line.line_type === "recipe" ? line.sub_recipe_id
            : line.line_type === "utility" ? line.utility_id
            : line.line_type === "fixed" ? line.fixed_price : null;
          if (selected === null || selected === undefined || selected === "" ||
              (line.line_type !== "fixed" && !(Number(selected) > 0))) {
            throw new Error(`Copied recipe row ${index + 1} has no valid source. Repair the row before creating the new menu item.`);
          }
        }
        const createRes = await fetch("/api/bo/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...recipeDraft,
            name: String(draft.name || recipeDraft.name).trim(),
            menu_category_id: draft.menu_category_id,
            kind: "menu",
            lines: recipeDraft.lines.map((line: Row) => ({ ...line, factor: 1, sub_cost_basis: "ingredients" })),
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok || !created?.id) {
          throw new Error(created?.error || "The copied recipe could not be saved. No new menu item was created.");
        }
        const newRecipeId = Number(created.id);
        // Retain the new recipe ID immediately; if a later step fails,
        // retry updates it instead of creating an extra recipe.
        outgoingRecipe = { ...recipeDraft, id: newRecipeId };
        setRecipeDraft(outgoingRecipe);
        setDraft((prev: any) => ({ ...prev, recipe_id: newRecipeId }));
        outgoingItem = { ...outgoingItem, recipe_id: newRecipeId };
        const verifyRes = await fetch(`/api/bo/recipes?id=${encodeURIComponent(String(newRecipeId))}`, { cache: "no-store" });
        const verified = await verifyRes.json();
        if (!verifyRes.ok || !Array.isArray(verified?.lines) || verified.lines.length !== recipeDraft.lines.length) {
          throw new Error(`The copied recipe was created but its ingredients were not verified (${verified?.lines?.length ?? 0}/${recipeDraft.lines.length}). The draft stays open for retry; no new menu item was created.`);
        }
      }
      if (!menuItemId) {
        const itemRes = await fetch("/api/bo/menu", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, recipe_id: Number(outgoingRecipe?.id) || null, recipe_factor: 1 }),
        });
        const itemJson = await itemRes.json();
        if (!itemRes.ok || !itemJson?.item?.id) throw new Error(itemJson?.error || "Could not create the new menu item. The saved recipe remains available for retry.");
        menuItemId = Number(itemJson.item.id);
        setEditing(itemJson.item);
      }
      outgoingItem = { ...outgoingItem, id: menuItemId, recipe_id: Number(outgoingRecipe?.id) || outgoingItem.recipe_id || null };
      const res = await fetch("/api/bo/menu/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: outgoingItem,
          recipe: outgoingRecipe ? { ...outgoingRecipe, lines: outgoingRecipe.lines.map((line: Row) => ({ ...line, factor: 1 })) } : null,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Unable to save changes.");
      }

      // Verify using the exact persisted recipe lines, not the costing snapshot.
      // The snapshot can be truncated by Supabase's default row limit.
      if (outgoingRecipe) {
        const recipeId = String(json.recipe_id ?? outgoingRecipe.id);
        const verifyRes = await fetch(`/api/bo/recipes?id=${encodeURIComponent(recipeId)}`, {
          cache: "no-store",
        });
        const verifyJson = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyJson?.error || "Unable to verify saved recipe.");
        const stored = verifyJson.lines ?? [];
        const expected = (outgoingRecipe.lines ?? []).map((line: Row) => ({ ...line, factor: 1 }));
        const normalize = (line: Row) => {
          const id = line.line_type === "ingredient" ? line.ingredient_id :
            line.line_type === "recipe" ? line.sub_recipe_id :
            line.line_type === "utility" ? line.utility_id : null;
          const num = (v: unknown, fallback: number) =>
            v === "" || v == null ? fallback : Number(v);
          return JSON.stringify([
            line.line_type, id == null || id === "" ? null : Number(id),
            num(line.qty, 0), 1,
            line.line_type === "fixed" ? num(line.fixed_price, 0) : null,
            line.line_type === "fixed" ? (line.fixed_currency === "USD" ? "USD" : "LBP") : null,
            String(line.note ?? "").trim(),
            line.needs_review === true,
          ]);
        };
        const available = new Map<string, number>();
        for (const line of stored) {
          const key = normalize(line);
          available.set(key, (available.get(key) ?? 0) + 1);
        }
        for (const [index, line] of expected.entries()) {
          const key = normalize(line);
          const count = available.get(key) ?? 0;
          if (!count) {
            const candidate = stored.find((savedLine: Row) => savedLine.line_type === line.line_type && String(savedLine.sub_recipe_id ?? savedLine.ingredient_id ?? savedLine.utility_id ?? "") === String(line.sub_recipe_id ?? line.ingredient_id ?? line.utility_id ?? ""));
            throw new Error(`Recipe row ${index + 1} (${line.line_type}) did not match after saving. ${candidate ? `Saved row has QTY ${candidate.qty}, review flag ${String(candidate.needs_review)}.` : `No matching source was found among ${stored.length} rows.`} Your draft remains open.`);
          }
          available.set(key, count - 1);
        }
      }

      await load();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  function renderLineTable({
    title,
    lines,
    utilityMode = false,
  }: {
    title: string;
    lines: { line: Row; index: number }[];
    utilityMode?: boolean;
  }) {
    return (
      <section className="overflow-hidden rounded-[14px] border border-[#c9c9c9] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9c9c9] bg-[#e7e7e7] px-4 py-3">
          <h3 className="text-[12px] font-black uppercase text-black">{title}</h3>

          <div className="flex gap-2">
            {utilityMode ? (
              <>
                <button
                  type="button"
                  onClick={() => addLine("utility")}
                  className="rounded-[8px] bg-black px-3 py-2 text-[10px] font-black uppercase text-white"
                >
                  ADD UTILITY
                </button>
                <button
                  type="button"
                  onClick={() => addLine("fixed")}
                  className="rounded-[8px] border border-black/20 bg-white px-3 py-2 text-[10px] font-black uppercase text-black"
                >
                  ADD FIXED COST
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => addLine("ingredient")}
                  className="rounded-[8px] bg-black px-3 py-2 text-[10px] font-black uppercase text-white"
                >
                  ADD INGREDIENT
                </button>
                <button
                  type="button"
                  onClick={() => addLine("recipe")}
                  className="rounded-[8px] border border-black/20 bg-white px-3 py-2 text-[10px] font-black uppercase text-black"
                >
                  ADD PREP / SAUCE
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead className="bg-[#f4f4f4] text-[10px] font-black uppercase text-[#333]">
              <tr>
                <th className="px-3 py-2 text-left">TYPE</th>
                <th className="px-3 py-2 text-left">ITEM</th>
                <th className="px-3 py-2 text-right">QTY</th>
                <th className="px-3 py-2 text-left">UNIT</th>
                <th className="px-3 py-2 text-right">UNIT COST USD</th>
                <th className="px-3 py-2 text-right">TOTAL COST USD</th>
                <th className="px-3 py-2 text-right">ACTION</th>
              </tr>
            </thead>

            <tbody>
              {lines.map(({ line, index }) => {
                const meta = sourceMeta(line);
                const total = lineTotal(line);

                return (
                  <tr key={index} className="border-t border-black/[0.08] text-[11px] text-black">
                    <td className="px-3 py-2">
                      <select
                        value={line.line_type}
                        onChange={(e) =>
                          updateLine(index, {
                            line_type: e.target.value,
                            ingredient_id: "",
                            sub_recipe_id: "",
                            utility_id: "",
                          })
                        }
                        className="w-full rounded-[7px] border border-[#aaa] bg-white px-2 py-2 font-bold text-black"
                      >
                        <option value="ingredient">INGREDIENT</option>
                        <option value="recipe">PREP / SAUCE</option>
                        <option value="utility">UTILITY</option>
                        <option value="fixed">FIXED</option>
                      </select>
                    </td>

                    <td className="px-3 py-2">
                      {line.line_type === "ingredient" ? (
                        <SearchablePicker
                          value={line.ingredient_id}
                          options={ingredientOptions}
                          placeholder="TYPE INGREDIENT NAME..."
                          onChange={(value) =>
                            updateLine(index, { ingredient_id: value })
                          }
                        />
                      ) : line.line_type === "recipe" ? (
                        <div className="min-w-[180px]">
                        <SearchablePicker
                          value={line.sub_recipe_id}
                          options={prepRecipeOptions}
                          placeholder="TYPE PREP / SAUCE NAME..."
                          onChange={(value) =>
                            updateLine(index, { sub_recipe_id: value, sub_cost_basis: "ingredients" })
                          }
                        />
                        </div>
                      ) : line.line_type === "utility" ? (
                        <SearchablePicker
                          value={line.utility_id}
                          options={utilityOptions}
                          placeholder="TYPE UTILITY NAME..."
                          onChange={(value) =>
                            updateLine(index, { utility_id: value })
                          }
                        />
                      ) : (
                        <input
                          value={line.fixed_price ?? ""}
                          onChange={(e) =>
                            updateLine(index, { fixed_price: e.target.value })
                          }
                          placeholder="FIXED COST"
                          className="w-full min-w-[180px] rounded-[7px] border border-[#aaa] bg-white px-2 py-2 font-semibold text-black"
                        />
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        value={line.qty ?? ""}
                        onChange={(e) =>
                          updateLine(index, { qty: e.target.value })
                        }
                        className="w-[84px] rounded-[7px] border border-[#aaa] bg-white px-2 py-2 text-right font-bold text-black"
                      />
                    </td>

                    <td className="px-3 py-2 font-semibold text-[#555]">
                      {meta.unit}
                    </td>

                    <td className="px-3 py-2 text-right font-black tabular-nums">
                      <span title={line.line_type === "recipe" && meta.cost === null ? String((meta as Row).reason || "Linked recipe cost unavailable") : undefined} className={line.line_type === "recipe" && meta.cost === null ? "text-amber-700 underline decoration-dotted cursor-help" : ""}>{meta.cost === null || !(Number(menuData?.usd_lbp_rate) > 0) ? "—" : moneyUsd(meta.cost / Number(menuData.usd_lbp_rate))}</span>
                    </td>

                    <td className="px-3 py-2 text-right font-black tabular-nums">
                      {total === null || !(Number(menuData?.usd_lbp_rate) > 0) ? "—" : moneyUsd(total / Number(menuData.usd_lbp_rate))}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button"
                          onClick={() => void toggleReviewFlag(index)}
                          title={line.needs_review ? "Clear Needs Review flag" : "Flag item for recipe review"}
                          aria-label={line.needs_review ? "Clear review flag" : "Flag item for review"}
                          aria-pressed={line.needs_review === true}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-[7px] border transition-colors ${line.needs_review ? "border-amber-500 bg-amber-100 text-amber-800" : "border-black/20 bg-white text-black hover:bg-gray-100"}`}>
                          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill={line.needs_review ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 21V4m0 1c4-3 7 3 12 0v11c-5 3-8-3-12 0" />
                          </svg>
                        </button>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="rounded-[7px] border border-black/20 bg-white px-3 py-2 text-[9px] font-black uppercase text-black hover:bg-black hover:text-white"
                      >
                        REMOVE
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!lines.length ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-[10px] font-black uppercase text-[#666]"
                  >
                    NO LINES
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const sortHeader = (key: string, label: string) => (
    <button type="button" onClick={() => {
      if (sortKey === key) setSortAscending(prev => !prev);
      else { setSortKey(key); setSortAscending(true); }
    }} className={`inline-flex w-full items-center gap-1 whitespace-nowrap font-bold hover:text-black ${key === "name" ? "justify-start" : "justify-end"}`} aria-label={`Sort by ${label}`}>
      {label}<span className="text-[10px] text-black/50">{sortKey === key ? (sortAscending ? "▲" : "▼") : "↕"}</span>
    </button>
  );
  const foodCostTone = (value: unknown) => {
    const n = Number(value);
    if (value == null || !Number.isFinite(n)) return "text-black/40";
    const percent = n * 100;
    return percent <= 30 ? "text-emerald-700" : percent <= 35 ? "text-amber-700" : "text-red-700";
  };
  const allCollapsed = categoryGroups.length > 0 && categoryGroups.every(g => collapsedCategories[g.id]);
  const resetFilters = () => { setSearch(""); setCategoryFilter("all"); setVisibilityFilter("visible"); setSortKey("name"); setSortAscending(true); };

  return (
    <BOFrame
      active="/bo/menu"
      title="RECIPES"
      subtitle="Manage recipes, visibility, and menu costing."
      actions={<button type="button" onClick={() => { setNewRecipeSearch(""); setError(""); setNewRecipePickerOpen(true); }} className="rounded-[10px] bg-black px-4 py-3 text-[11px] font-black uppercase text-white hover:bg-black/80">ADD RECIPE</button>}
    >
      {error ? (
        <div className="mb-4 rounded-[10px] border border-black/15 bg-white px-4 py-3 text-[12px] font-bold text-black">
          {error}
        </div>
      ) : null}

      {notice ? <div role="status" className="mb-3 rounded-lg border border-black/10 bg-white px-4 py-2 text-xs">{notice}</div> : null}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white p-3 xl:flex-nowrap">
        <input aria-label="Search recipes" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item or recipe"
          className="min-w-[170px] flex-1 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs" />
        <select aria-label="Category filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="min-w-[150px] flex-1 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs">
          <option value="all">All categories</option>
          {MENU_FAMILIES.map(family => <optgroup key={family} label={family.toUpperCase()}>{(menuData?.categories ?? []).filter((cat: Row) => menuFamily(cat.name) === family).map((cat: Row) => <option key={cat.id} value={String(cat.id)}>{cat.name}</option>)}</optgroup>)}
          <option value="none">Uncategorized</option>
        </select>
        <select aria-label="Visibility filter" value={visibilityFilter} onChange={e => setVisibilityFilter(e.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-black/20 bg-white px-3 py-2 text-xs">
          <option value="visible">Visible on Menu Pricing</option><option value="hidden">Hidden on Menu Pricing</option><option value="review">Needs Review</option><option value="all">All items</option>
        </select>
        <button type="button" title="Reset filters" aria-label="Reset filters" onClick={resetFilters} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/20 bg-white hover:bg-gray-100">
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>
        </button>
        <button type="button" title={allCollapsed ? "Expand all categories" : "Collapse all categories"} aria-label={allCollapsed ? "Expand all categories" : "Collapse all categories"} onClick={() => setCollapsedCategories(Object.fromEntries(categoryGroups.map(g => [g.id, !allCollapsed])))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/20 bg-white hover:bg-gray-100">
          {allCollapsed ? <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v10M7 12h10"/></svg> : <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 12h10"/></svg>}
        </button>
      </div>
      {selectedIds.length > 0 && (
      <div role="region" aria-label="Selected recipes actions" className="sticky top-[82px] z-30 mb-3 flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border border-black/20 bg-white p-3 text-xs shadow-lg xl:flex-nowrap">
        <label className="inline-flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={allVisibleSelected} disabled={!visibleSelectionIds.length || bulkBusy}
            onChange={e => toggleGroupSelection(visibleSelectionIds, e.target.checked)} />
          Select visible
        </label>
        <span className="text-black/60">{selectedIds.length} selected</span>
        <button type="button" onClick={() => { setSelectedIds([]); selectionAnchor.current = null; }} disabled={!selectedIds.length || bulkBusy}
          className="rounded-md border border-black/20 px-2 py-2 disabled:opacity-40">Clear</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void runBulk("hide")} disabled={!selectedItems.length || bulkBusy}
            className="rounded-md border border-black/20 px-3 py-2 font-bold disabled:opacity-40">Hide selected</button>
          <select aria-label="Destination category" value={bulkCategory} disabled={bulkBusy} onChange={e => setBulkCategory(e.target.value)}
            className="max-w-[190px] rounded-md border border-black/20 bg-white px-2 py-2">
            <option value="">Move to category…</option>
            {MENU_FAMILIES.map(family => <optgroup key={family} label={family.toUpperCase()}>{(menuData?.categories ?? []).filter((category: Row) => menuFamily(category.name) === family).map((category: Row) => <option key={category.id} value={String(category.id)}>{category.name}</option>)}</optgroup>)}
            <option value="none">Uncategorized</option>
          </select>
          <button type="button" onClick={() => void runBulk("category")} disabled={!selectedItems.length || !bulkCategory || bulkBusy}
            className="rounded-md border border-black/20 px-3 py-2 font-bold disabled:opacity-40">Move</button>
          <button type="button" onClick={() => void runBulk("flag")} disabled={!selectedItems.length || bulkBusy}
            className="rounded-md border border-amber-300 px-3 py-2 font-bold text-amber-800 disabled:opacity-40">Flag for review</button>
          <button type="button" onClick={() => void runBulk("unflag")} disabled={!selectedItems.length || bulkBusy}
            className="rounded-md border border-black/20 px-3 py-2 font-bold text-black disabled:opacity-40">Clear review flags</button>
          <button type="button" onClick={() => void runBulk("delete")} disabled={!selectedItems.length || bulkBusy}
            className="rounded-md border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-40">Delete selected</button>
        </div>
      </div>
      )}
      <div className="space-y-3">
        {categoryGroups.map(group => <section key={group.id} className="overflow-hidden rounded-xl border border-black/15 bg-white">
          <button type="button" onClick={() => setCollapsedCategories(prev => ({...prev, [group.id]: !prev[group.id]}))}
            aria-expanded={!collapsedCategories[group.id]} className="flex w-full items-center justify-between bg-gray-100 px-4 py-3 text-left text-xs font-bold uppercase">
            <span>{group.name} ({group.items.length})</span><span>{collapsedCategories[group.id] ? "+" : "−"}</span>
          </button>
          {!collapsedCategories[group.id] && <div className="overflow-x-auto"><table className="w-full min-w-[1130px] border-collapse text-left text-[12px]">
            <thead className="bg-gray-50 text-[10px] uppercase text-black/65"><tr>
              <th className="w-9 px-2 py-2"><input aria-label={`Select all in ${group.name}`} type="checkbox"
                checked={group.items.length > 0 && group.items.every((row: Row) => selectedIds.includes(Number(row.id)))}
                disabled={bulkBusy} onChange={e => toggleGroupSelection(group.items.map((row: Row) => Number(row.id)), e.target.checked)} /></th>
              <th className="px-3 py-2">{sortHeader("name", "Items")}</th>
              <th className="px-2 py-2 text-right">{sortHeader("sp_usd", "Selling Price USD")}</th>
              <th className="px-2 py-2 text-right">{sortHeader("sp_lbp", "Selling Price LBP")}</th>
              <th className="px-2 py-2 text-right">{sortHeader("cost_lbp", "Cost LBP")}</th>
              <th className="px-2 py-2 text-right">{sortHeader("food_cost_pct", "Food Cost %")}</th>
              <th className="px-2 py-2 text-right">{sortHeader("profit_usd", "Profit USD")}</th>
              <th className="px-2 py-2 pr-5 text-right">{sortHeader("profit_lbp", "Profit LBP")}</th>
              <th className="py-2 pl-5 pr-2 text-left">Actions</th>
            </tr></thead>
            <tbody>{group.items.map((row: Row) => <tr key={row.id} className="border-t border-black/10">
              <td className="w-9 px-2 py-1.5"><input type="checkbox" aria-label={`Select ${row.name}`}
                checked={selectedIds.includes(Number(row.id))} disabled={bulkBusy}
                onClick={e => selectRow(Number(row.id), e.shiftKey)}
                readOnly /></td>
              <td className="px-3 py-1.5 font-bold"><span className="inline-flex items-center gap-2"><button type="button" onClick={() => startEdit(row)} className="text-left font-bold hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-black" title={`Edit ${row.name}`}>{row.name}</button>{hasFlaggedLines(row) && <span title="Recipe has items needing review" aria-label="Needs review" className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6"><path d="M5 21V4m0 1c4-3 7 3 12 0v11c-5 3-8-3-12 0" /></svg>Review</span>}</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{moneyUsd(row.sp_usd)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{moneyLbp(row.sp_lbp)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{moneyLbp(row.cost_lbp)}</td>
              <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${foodCostTone(row.food_cost_pct)}`}>{row.sp_usd > 0 ? pct(row.food_cost_pct) : "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.sp_usd > 0 && Number(menuData?.usd_lbp_rate) > 0 ? moneyUsd(Number(row.gross_profit_lbp ?? 0) / Number(menuData.usd_lbp_rate)) : "—"}</td>
              <td className="py-1.5 pl-2 pr-5 text-right tabular-nums">{row.sp_usd > 0 ? moneyLbp(row.gross_profit_lbp) : "—"}</td>
              <td className="py-1.5 pl-5 pr-2"><div className="flex items-center justify-start gap-1.5">
                <button type="button" disabled={actionBusy !== null} onClick={() => toggleVisibility(row)} title={row.active === false ? "Show on Menu Pricing" : "Hide from Menu Pricing"}
                  aria-label={`${row.active === false ? "Show" : "Hide"} ${row.name} on Menu Pricing`} className={`flex h-9 w-9 items-center justify-center rounded-md border hover:bg-gray-100 disabled:opacity-50 ${row.active === false ? "border-red-300 text-red-700" : "border-black/20"}`}>
                  <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{row.active === false && <path d="M3 3l18 18"/>}</svg>
                </button>
                <button type="button" onClick={() => void viewPhoto(row)} disabled={!photoIds.has(Number(row.id)) || photoLoading !== null}
                  title={photoIds.has(Number(row.id)) ? "View recipe photo" : "No recipe photo uploaded"}
                  aria-label={`View photo for ${row.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-black/20 bg-white hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                  <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                  </svg>
                </button>
                <button type="button" onClick={() => downloadRecipe(row)} title="Download recipe" aria-label={`Download ${row.name}`} className="flex h-9 w-9 items-center justify-center rounded-md border border-black/20 hover:bg-gray-100">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4"/></svg>
                </button>
                <button type="button" onClick={() => startEdit(row)} className="h-9 rounded-md bg-black px-3 text-[11px] font-bold text-white">Edit</button>
                <button type="button" disabled={actionBusy !== null} onClick={() => deleteItem(row)} className="h-9 rounded-md border border-red-300 px-3 text-[11px] font-bold text-red-700 disabled:opacity-50">Delete</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
        </section>)}
      </div>

      {photoPreview && (
        <div role="presentation" className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={() => setPhotoPreview(null)}>
          <section role="dialog" aria-modal="true" aria-label={`Recipe photo: ${photoPreview.name}`} onClick={e => e.stopPropagation()}
            className="w-full max-w-[760px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
              <h3 className="min-w-0 truncate text-sm font-black text-black">{photoPreview.name}</h3>
              <button type="button" onClick={() => setPhotoPreview(null)} aria-label="Close photo" className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/15 text-xl">×</button>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center bg-gray-100 p-3">
              <img src={photoPreview.url} alt={`Photo of ${photoPreview.name}`} className="max-h-[74vh] max-w-full rounded-lg object-contain" />
            </div>
          </section>
        </div>
      )}

      {moveTarget && (
        <div role="presentation" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-4" onClick={() => { if (!moveBusy) setMoveTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-label="Move recipe to production" onClick={e => e.stopPropagation()}
            className="w-full max-w-[470px] overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-5">
              <div><p className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-500">RECIPE MANAGEMENT</p><h3 className="text-xl font-black uppercase text-black">MOVE TO PRODUCTION</h3></div>
              <button type="button" disabled={moveBusy} onClick={() => setMoveTarget(null)} aria-label="Close move dialog" className="rounded-lg border border-black/20 px-3 py-1.5 text-lg text-black">×</button>
            </div>
            <div className="space-y-4 p-6 text-black">
              <p className="text-sm">Move <strong>{moveTarget.name}</strong> out of Recipes and Menu Pricing into the production library.</p>
              <label className="block text-[11px] font-black uppercase">Destination
                <select value={moveKind} onChange={e => setMoveKind(e.target.value as "prep" | "sauce")}
                  disabled={moveBusy} className="mt-2 w-full rounded-lg border border-black/25 bg-white px-3 py-3 text-sm font-bold text-black">
                  <option value="prep">Prep</option><option value="sauce">Sauces</option>
                </select>
              </label>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">The menu item and its selling price will be removed from Menu Pricing. The recipe, ingredients, quantities, costs and review flags are retained. This cannot be undone with one click.</div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-black/10 px-6 py-4">
              <button type="button" disabled={moveBusy} onClick={() => setMoveTarget(null)} className="rounded-lg border border-black/20 px-4 py-2.5 text-xs font-bold text-black">CANCEL</button>
              <button type="button" disabled={moveBusy} onClick={() => void moveToProduction()} className="rounded-lg bg-black px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{moveBusy ? "MOVING..." : `MOVE TO ${moveKind === "prep" ? "PREP" : "SAUCES"}`}</button>
            </div>
          </section>
        </div>
      )}
      {newRecipePickerOpen ? (
        <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => setNewRecipePickerOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Choose menu item for new recipe" onClick={event => event.stopPropagation()}
            className="w-full max-w-[560px] rounded-2xl border border-black/15 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-black uppercase">Add Recipe</h2>
              <button type="button" className="h-9 w-9 rounded-lg border border-black/20" aria-label="Close" onClick={() => setNewRecipePickerOpen(false)}>×</button>
            </div>
            <label className="block text-xs font-bold uppercase text-black/70">Search by item name
              <input autoFocus value={newRecipeSearch} onChange={event => setNewRecipeSearch(event.target.value)}
                placeholder="Search menu item…" className="mt-2 w-full rounded-lg border border-black/20 px-3 py-3 text-sm font-normal text-black" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => startNewRecipeNamed(newRecipeSearch)} className="rounded-lg bg-black px-3 py-3 text-xs font-bold text-white">CREATE {newRecipeSearch.trim() ? `“${newRecipeSearch.trim()}”` : "NEW RECIPE"}</button>
              <button type="button" onClick={() => startNewRecipeNamed("")} className="rounded-lg border border-black/20 px-3 py-3 text-xs font-bold">START BLANK</button>
            </div>
            <div className="mt-3 max-h-[370px] overflow-y-auto rounded-lg border border-black/10">
              {searchableMenuItems.map((row: Row) => (
                <button type="button" key={row.id} onClick={() => startNewRecipeForItem(row)}
                  className="flex w-full items-center justify-between gap-3 border-b border-black/10 px-3 py-3 text-left text-sm hover:bg-gray-100 last:border-0">
                  <span className="font-semibold">{row.name}</span>
                  <span className="shrink-0 text-xs text-black/50">{row.recipe_id ? "Create independent copy" : "Create new recipe"}</span>
                </button>
              ))}
              {searchableMenuItems.length === 0 ? <p className="p-4 text-sm text-black/60">No matching menu items.</p> : null}
            </div>
            <p className="mt-3 text-xs text-black/60">Select an existing item to create a separate copy with its own menu item and recipe IDs. Rename the copy before saving if needed. The original is not modified.</p>
          </div>
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-5"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto my-2 w-full max-w-[1460px] overflow-hidden rounded-[20px] border border-[#c7c7c7] bg-[#f5f5f5] shadow-2xl"
          >
            <div className="sticky top-0 z-30 flex items-start justify-between border-b border-[#d0d0d0] bg-white px-6 py-5">
              <div>
                <div className="text-[10px] font-black uppercase text-[#555]">
                  MENU ITEM COSTING
                </div>
                <h2 className="mt-1 text-[26px] font-black uppercase text-black">
                  EDIT MENU ITEM
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-full border border-black/15 bg-white text-[20px] text-black"
              >
                ×
              </button>
            </div>

            {error ? (
              <div className="mx-6 mt-5 rounded-[10px] border border-black bg-white px-4 py-3 text-[12px] font-bold text-black">
                SAVE ERROR: {error}
              </div>
            ) : null}

            <div className="space-y-5 p-6">
              <section className="rounded-[14px] border border-[#c9c9c9] bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_322px] lg:items-stretch">
                  <div className="grid w-full min-w-0 content-start grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,340px)_minmax(0,190px)_minmax(0,1fr)] lg:h-full lg:grid-rows-[auto_auto_1fr]">
                    <div className="min-w-0 sm:max-w-[340px]">
<label className="min-w-0 text-left">
                    <span className="mb-1 block text-left text-[10px] font-black uppercase text-[#444]">DISH NAME</span>
                    <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-2.5 font-bold text-black" />
                    {Number(editing?.id) > 0 && String(draft.name ?? "").trim() !== String(editing?.name ?? "").trim() ? (
                      <button type="button" disabled={saving} onClick={saveDishName}
                        className="mt-2 w-full rounded-[8px] bg-black px-3 py-2 text-[11px] font-black uppercase text-white disabled:opacity-50">
                        {saving ? "Saving..." : "Save Name Only"}
                      </button>
                    ) : null}
                    </label>
                    </div>
                    <div className="min-w-0 sm:max-w-[190px]">
<label className="min-w-0 text-left">
                    <span className="mb-1 block text-left text-[10px] font-black uppercase text-[#444]">SELLING PRICE USD</span>
                    <input value={draft.sp_usd} onChange={(e) => setDraft({ ...draft, sp_usd: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-2.5 font-black text-black" />
                    </label>
                    </div>
                    <div className="min-w-0">
                    <div className="min-w-0 text-left">
                    <span className="mb-1 block text-left text-[10px] font-black uppercase text-[#444]">ACTIONS</span>
                    <div className="flex h-[43px] items-center gap-2">
                      <button type="button" disabled={saving || actionBusy !== null}
                        onClick={async () => {
                          // Visibility is part of the editable draft, including new recipes.
                          // Save Changes persists it; do not call the saved-item API here.
                          setDraft((current: any) => ({ ...current, active: current.active === false }));
                        }}
                        aria-label={draft.active ? "Set hidden on Menu Pricing (save to apply)" : "Set visible on Menu Pricing (save to apply)"}
                        title={draft.active ? "Visible: click to hide, then Save Changes" : "Hidden: click to show, then Save Changes"}
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/20 bg-white text-black disabled:opacity-50">
                        {draft.active ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.5 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-3 3.6M6.3 6.3C3.6 8.1 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1.1"/></svg>}
                      </button>
                      <button type="button" disabled={saving || actionBusy !== null || !editing?.id}
                        onClick={() => { if (editing?.id) requestMove(editing); }}
                        aria-label="Move recipe to Prep or Sauces" title="Move recipe to Prep or Sauces"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-50">
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>
                      </button>
                      <button type="button" disabled={saving || !editing?.recipe_id}
                        onClick={() => { if (editing) downloadRecipe(editing); }}
                        aria-label="Download recipe PDF" title="Download recipe PDF"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/20 bg-white text-black hover:bg-gray-100 disabled:opacity-50">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4"/></svg>
                      </button>
                      <button type="button" disabled={saving || actionBusy !== null}
                        onClick={async () => {
                          if (!editing) return;
                          await deleteItem(editing);
                        }}
                        aria-label="Delete recipe menu item" title="Delete menu item"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 disabled:opacity-50">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
                      </button>
                      </div>
                    </div>
                    </div>
                    <div className="min-w-0 sm:max-w-[340px]">
<label className="min-w-0 text-left">
                    <span className="mb-1 block text-left text-[10px] font-black uppercase text-[#444]">CATEGORY</span>
                    <select value={draft.menu_category_id} onChange={(e) => setDraft({ ...draft, menu_category_id: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-2.5 font-bold text-black">
                      <option value="">SELECT</option>
                      {(menuData?.categories ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    </label>
                    </div>
                    <div className="min-w-0 sm:w-[230px]">
<label className="min-w-0 text-left">
                    <span className="mb-1 block text-left text-[10px] font-black uppercase text-[#444]">POS NAME</span>
                    <input disabled value="" placeholder="POS Name" title="POS Name (database field not yet configured)" className="w-full rounded-[8px] border border-[#aaa] bg-gray-50 px-3 py-2.5 text-left text-black" />
                    </label>
                    </div>
                  <section className="col-span-full mt-1 min-w-0 lg:self-end">
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {[
                                    ["SELLING PRICE", draft.sp_usd !== "" && draft.sp_usd != null ? moneyUsd(Number(draft.sp_usd)) : "—", moneyLbp(salePriceLbp)],
                                    ["TOTAL COST", displayUsd(totalCost), moneyLbp(totalCost)],
                                    ["UTILITY COST", displayUsd(utilityCostLbp), moneyLbp(utilityCostLbp)],
                                    ["FOOD COST %", pct(foodCost), ""],
                                    ["NET PROFIT", displayUsd(profit), moneyLbp(profit)],
                                    ["MARGIN PROFIT %", pct(margin), ""],
                                  ].map(([label, value, note]) => (
                                    <div key={label} className="min-w-0 rounded-[12px] border border-[#c9c9c9] bg-[#f5f5f5] p-3 text-left">
                                      <div className="text-left text-[10px] font-black uppercase text-[#444]">{label}</div>
                                      <div className={`mt-2 break-words text-left text-[16px] font-black xl:text-[16px] 2xl:text-[18px] ${label === "FOOD COST %" ? foodCostTone(foodCost) : label === "MARGIN PROFIT %" && margin != null ? foodCostTone(1 - margin) : "text-black"}`}>{value}</div>
                                      {note ? <div className="mt-1 text-left text-[10px] font-semibold text-[#666]">{note}</div> : null}
                                    </div>
                                  ))}
                                  </div>
                                </section>
                  </div>
                  <RecipePhotoEditor menuItemId={Number(editing?.id) || null} />
                </div>
              </section>


              {recipeDraft ? (
                <>
                  {!recipeDraft.id && (
                    <p className="rounded-lg border border-black/15 bg-white px-4 py-2 text-xs text-black/75">
                      No recipe was linked to this menu item. Add its ingredients below, then Save Changes to create and link the recipe.
                    </p>
                  )}
                  {renderLineTable({ title: "INGREDIENTS", lines: ingredientsWithIndex })}
                  {renderLineTable({ title: "UTILITY COST", lines: utilityWithIndex, utilityMode: true })}
                  {unresolvedWithIndex.length > 0 && (
                    <section className="overflow-hidden rounded-[14px] border border-amber-300 bg-white">
                      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                        <h3 className="text-[12px] font-black uppercase text-amber-950">
                          UNRESOLVED ITEMS ({unresolvedWithIndex.length}) — ACTION REQUIRED
                        </h3>
                        <p className="mt-1 text-[11px] text-amber-950">
                          These rows were imported without a valid source. They are not included in costing.
                          Choose a source type and then select the correct item in its table, or remove the row explicitly.
                          Other recipe rows will not be silently removed.
                        </p>
                      </div>
                      <div className="space-y-3 p-4">
                        {unresolvedWithIndex.map(({ line, index }) => (
                          <div key={`${line.id ?? "new"}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/30 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black text-black">{String(line.label || line.sourceName || `Imported row ${index + 1}`)}</p>
                                <p className="mt-1 text-xs text-gray-700">
                                  Recipe row {index + 1} · Qty {String(line.qty ?? "—")} · Source not linked
                                  {line.id ? ` · Saved line #${line.id}` : ""}
                                </p>
                                {line.note ? <p className="mt-1 text-xs text-gray-600">{String(line.note)}</p> : null}
                                {line.source_formula ? <p className="mt-1 break-all font-mono text-[10px] text-gray-500">Original formula: {String(line.source_formula)}</p> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-2 text-[11px] font-bold text-black">
                                  REPAIR AS
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      if (["ingredient", "recipe", "utility", "fixed"].includes(next))
                                        repairUnresolved(index, next as "ingredient" | "recipe" | "utility" | "fixed");
                                    }}
                                    className="rounded-lg border border-black/25 bg-white px-3 py-2 text-xs font-semibold text-black"
                                  >
                                    <option value="">Choose type...</option>
                                    <option value="utility">Utility</option>
                                    <option value="ingredient">Ingredient</option>
                                    <option value="recipe">Prep / Sauce</option>
                                    <option value="fixed">Fixed Cost</option>
                                  </select>
                                </label>
                                <button type="button"
                                  onClick={() => {
                                    if (window.confirm(`Remove imported unresolved item “${String(line.label || line.sourceName || "Unknown")}” from this recipe? The deletion will take effect when you save.`)) {
                                      removeLine(index);
                                      setError("");
                                    }
                                  }}
                                  className="rounded-lg border border-red-300 bg-white px-3 py-2 text-[11px] font-black text-red-700 hover:bg-red-50"
                                >REMOVE</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {availableUtilities.length > 0 && (
                    <div className="rounded-xl border border-black/15 bg-white px-4 py-3">
                      <div className="mb-2 text-[11px] font-black uppercase">Available utilities ({availableUtilities.length})</div>
                      <p className="mb-3 text-[11px] text-black/60">All remaining utilities are listed below. Add one to this recipe at QTY 1. Nothing is added to costing until you select Add Utility and save.</p>
                      <div className="flex flex-wrap gap-2">
                        {availableUtilities.map((utility: Row) => (
                          <button key={utility.id} type="button"
                            onClick={() => addSpecificUtility(utility.id)}
                            className="rounded-md border border-black/20 bg-white px-3 py-2 text-[11px] font-bold text-black hover:bg-black hover:text-white"
                            title={`Add ${utility.name} at QTY 1`}>
                            + {utility.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="sticky bottom-0 z-30 flex items-center justify-between border-t border-[#d0d0d0] bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[9px] border border-black/20 px-5 py-3 text-[11px] font-black uppercase text-black"
              >
                CANCEL
              </button>

              <button
                disabled={saving}
                className="rounded-[9px] bg-black px-7 py-3 text-[11px] font-black uppercase text-white disabled:opacity-50"
              >
                {saving ? "SAVING..." : "SAVE CHANGES"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </BOFrame>
  );
}
