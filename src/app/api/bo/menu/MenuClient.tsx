"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BOFrame } from "../BOFrame";
import { SearchablePicker } from "../SearchablePicker";
import { moneyLbp, moneyUsd, pct } from "../format";

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
  utility_id: "",
  qty: "",
  factor: "1",
  fixed_price: "",
  fixed_currency: "LBP",
  in_yield: true,
  note: "",
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
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<any>({ ...EMPTY_ITEM });
  const [recipeDraft, setRecipeDraft] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");

    const [menuRes, recipeRes] = await Promise.all([
      fetch("/api/bo/menu", { cache: "no-store" }),
      fetch("/api/bo/recipes?kind=menu", { cache: "no-store" }),
    ]);

    const menuJson = await menuRes.json();
    const recipeJson = await recipeRes.json();

    if (!menuRes.ok) {
      setError(menuJson?.error || "Unable to load menu.");
      return;
    }

    if (!recipeRes.ok) {
      setError(recipeJson?.error || "Unable to load recipes.");
      return;
    }

    setMenuData(menuJson);
    setRecipeData(recipeJson);
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (menuData?.items ?? []).filter(
      (row: Row) =>
        !q ||
        String(row.name).toLowerCase().includes(q) ||
        String(row.recipe?.name ?? "").toLowerCase().includes(q),
    );
  }, [menuData, search]);

  const ingredients: Row[] = recipeData?.ingredients ?? [];
  const utilities: Row[] = recipeData?.utilities ?? [];
  const allRecipes: Row[] = recipeData?.all_recipes ?? [];

  function buildRecipeDraft(recipe: Row | null) {
    if (!recipe) {
      setRecipeDraft(null);
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
        utility_id: line.utility_id ? String(line.utility_id) : "",
        qty: line.qty ?? "",
        factor: line.factor ?? "1",
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
      recipe_factor: row.recipe_factor ?? "1",
      sp_usd: row.sp_usd ?? "",
      active: row.active !== false,
    };

    setDraft(nextDraft);

    const recipe = (recipeData?.recipes ?? []).find(
      (x: Row) => String(x.id) === String(nextDraft.recipe_id),
    ) ?? null;

    buildRecipeDraft(recipe);
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

  function removeLine(index: number) {
    if (!recipeDraft) return;

    setRecipeDraft({
      ...recipeDraft,
      lines: recipeDraft.lines.filter((_: Row, i: number) => i !== index),
    });
  }

  function sourceMeta(line: Row) {
    if (line.line_type === "ingredient") {
      const source = ingredients.find(
        (x: Row) => String(x.id) === String(line.ingredient_id),
      );
      return {
        name: source?.name ?? "SELECT INGREDIENT",
        unit: source?.consumption_unit || source?.purchase_unit || "—",
        cost: asNumber(source?.unit_cost_lbp),
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
      const cost =
        line.sub_basis === "batch"
          ? asNumber(source?.batch_cost_lbp)
          : asNumber(source?.unit_cost_lbp);

      return {
        name: source?.name ?? "SELECT PREP / SAUCE",
        unit: source?.yield_unit || "—",
        cost,
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
    const factor = asNumber(line.factor) ?? 1;

    if (source.cost === null || qty === null) return null;
    return source.cost * qty * factor;
  }

  const recipeFactor = asNumber(draft.recipe_factor) ?? 1;
  const recipeLines: Row[] = recipeDraft?.lines ?? [];

  const ingredientsWithIndex = recipeLines
    .map((line: Row, index: number) => ({ line, index }))
    .filter(({ line }) => {
      const section = String(line.section || "").toLowerCase();
      return (
        line.line_type === "ingredient" ||
        section === "primary" ||
        section === "secondary"
      );
    });

  const utilityWithIndex = recipeLines
    .map((line: Row, index: number) => ({ line, index }))
    .filter(({ line }) => {
      const section = String(line.section || "").toLowerCase();
      return (
        section === "utility" ||
        line.line_type === "utility" ||
        line.line_type === "fixed" ||
        line.line_type === "recipe"
      );
    });

  const liveRecipeCost = recipeLines.reduce((sum, line) => {
    const total = lineTotal(line);
    return sum + (total ?? 0);
  }, 0);

  const yieldQty = asNumber(recipeDraft?.yield_qty);
  const waste = Math.min(0.99, Math.max(0, asNumber(recipeDraft?.waste_pct) ?? 0));
  const usableYield = yieldQty && yieldQty > 0 ? yieldQty * (1 - waste) : null;
  const liveUnitCost =
    usableYield && usableYield > 0 ? liveRecipeCost / usableYield : null;

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

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (recipeDraft?.id) {
        const recipeRes = await fetch("/api/bo/recipes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recipeDraft),
        });

        const recipeJson = await recipeRes.json();

        if (!recipeRes.ok) {
          throw new Error(recipeJson?.error || "Unable to save recipe.");
        }
      }

      const menuRes = await fetch("/api/bo/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editing?.id }),
      });

      const menuJson = await menuRes.json();

      if (!menuRes.ok) {
        throw new Error(menuJson?.error || "Unable to save menu item.");
      }

      await load();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  }

  function LineTable({
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
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead className="bg-[#f4f4f4] text-[10px] font-black uppercase text-[#333]">
              <tr>
                <th className="px-3 py-3">GROUP</th>
                <th className="px-3 py-3">TYPE</th>
                <th className="px-3 py-3">SOURCE</th>
                <th className="px-3 py-3 text-right">QTY</th>
                <th className="px-3 py-3">UNIT</th>
                <th className="px-3 py-3 text-right">UNIT COST</th>
                <th className="px-3 py-3 text-right">FACTOR</th>
                <th className="px-3 py-3 text-right">TOTAL COST</th>
                <th className="px-3 py-3">REMARK</th>
                <th className="px-3 py-3 text-right">ACTION</th>
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
                        value={line.section}
                        onChange={(e) =>
                          updateLine(index, { section: e.target.value })
                        }
                        className="w-full rounded-[7px] border border-[#aaa] bg-white px-2 py-2 font-bold text-black"
                      >
                        <option value="primary">PRIMARY</option>
                        <option value="secondary">SECONDARY</option>
                        <option value="utility">UTILITY</option>
                        <option value="main">OTHER</option>
                      </select>
                    </td>

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
                        <SearchablePicker
                          value={line.sub_recipe_id}
                          options={prepRecipeOptions}
                          placeholder="TYPE PREP / SAUCE NAME..."
                          onChange={(value) =>
                            updateLine(index, { sub_recipe_id: value })
                          }
                        />
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
                      {moneyLbp(meta.cost)}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        value={line.factor ?? "1"}
                        onChange={(e) =>
                          updateLine(index, { factor: e.target.value })
                        }
                        className="w-[90px] rounded-[7px] border border-[#aaa] bg-white px-2 py-2 text-right font-bold text-black"
                      />
                    </td>

                    <td className="px-3 py-2 text-right font-black tabular-nums">
                      {moneyLbp(total)}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        value={line.note ?? ""}
                        onChange={(e) =>
                          updateLine(index, { note: e.target.value })
                        }
                        placeholder="REMARK"
                        className="w-full min-w-[150px] rounded-[7px] border border-[#aaa] bg-white px-2 py-2 text-black"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="rounded-[7px] border border-black/20 bg-white px-3 py-2 text-[9px] font-black uppercase text-black hover:bg-black hover:text-white"
                      >
                        REMOVE
                      </button>
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

  return (
    <BOFrame
      active="/bo/menu"
      title="MENU COSTING"
      subtitle="Edit menu items and their recipe costs."
    >
      {error ? (
        <div className="mb-4 rounded-[10px] border border-black/15 bg-white px-4 py-3 text-[12px] font-bold text-black">
          {error}
        </div>
      ) : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH MENU ITEM OR RECIPE"
        className="mb-4 w-full rounded-[10px] border border-[#c5c5c5] bg-white px-4 py-3 text-[12px] font-bold text-black outline-none focus:border-black"
      />

      <div className="overflow-hidden rounded-[14px] border border-[#c9c9c9] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left">
            <thead className="bg-[#e9e9e9] text-[10px] font-black uppercase text-[#333]">
              <tr>
                <th className="px-4 py-3">ITEM</th>
                <th className="px-3 py-3">RECIPE</th>
                <th className="px-3 py-3 text-right">SP USD</th>
                <th className="px-3 py-3 text-right">SP LBP</th>
                <th className="px-3 py-3 text-right">COST</th>
                <th className="px-3 py-3 text-right">FOOD COST</th>
                <th className="px-3 py-3 text-right">PROFIT</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row: Row) => (
                <tr key={row.id} className="border-t border-black/[0.08] text-[11px] text-black">
                  <td className="px-4 py-3 font-black">{row.name}</td>
                  <td className="px-3 py-3">{row.recipe?.name || "—"}</td>
                  <td className="px-3 py-3 text-right">{moneyUsd(row.sp_usd)}</td>
                  <td className="px-3 py-3 text-right">{moneyLbp(row.sp_lbp)}</td>
                  <td className="px-3 py-3 text-right">{moneyLbp(row.cost_lbp)}</td>
                  <td className="px-3 py-3 text-right font-black">{pct(row.food_cost_pct)}</td>
                  <td className="px-3 py-3 text-right">{moneyLbp(row.gross_profit_lbp)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-[8px] bg-black px-3 py-2 text-[10px] font-black uppercase text-white"
                    >
                      EDIT
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

            <div className="space-y-5 p-6">
              <section className="rounded-[14px] border border-[#c9c9c9] bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-12">
                  <label className="lg:col-span-4">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">DISH NAME</span>
                    <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black" />
                  </label>

                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">CATEGORY</span>
                    <select value={draft.menu_category_id} onChange={(e) => setDraft({ ...draft, menu_category_id: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black">
                      <option value="">SELECT</option>
                      {(menuData?.categories ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>

                  <label className="lg:col-span-3">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">RECIPE</span>
                    <select value={draft.recipe_id} onChange={(e) => changeRecipe(e.target.value)} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black">
                      <option value="">SELECT RECIPE</option>
                      {(recipeData?.recipes ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>

                  <label className="lg:col-span-3">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">COVER SECTION</span>
                    <select value={draft.cover_section_id} onChange={(e) => setDraft({ ...draft, cover_section_id: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black">
                      <option value="">SELECT</option>
                      {(menuData?.cover_sections ?? []).map((x: Row) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </label>

                  <label className="lg:col-span-3">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">SELLING PRICE USD</span>
                    <input value={draft.sp_usd} onChange={(e) => setDraft({ ...draft, sp_usd: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-black text-black" />
                  </label>

                  <label className="lg:col-span-2">
                    <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">RECIPE FACTOR</span>
                    <input value={draft.recipe_factor} onChange={(e) => setDraft({ ...draft, recipe_factor: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-black text-black" />
                  </label>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["SALE PRICE", moneyLbp(salePriceLbp), draft.sp_usd ? moneyUsd(Number(draft.sp_usd)) : "—"],
                  ["TOTAL COST", moneyLbp(totalCost), "LIVE RECIPE COST"],
                  ["FOOD COST", pct(foodCost), "COST ÷ SELLING PRICE"],
                  ["NET PROFIT", moneyLbp(profit), `${pct(margin)} MARGIN`],
                ].map(([label, value, note]) => (
                  <div key={label} className="rounded-[12px] border border-[#c9c9c9] bg-white p-4">
                    <div className="text-[10px] font-black uppercase text-[#444]">{label}</div>
                    <div className="mt-2 text-[20px] font-black text-black">{value}</div>
                    <div className="mt-1 text-[10px] font-semibold text-[#666]">{note}</div>
                  </div>
                ))}
              </section>

              {recipeDraft ? (
                <>
                  <section className="rounded-[14px] border border-[#c9c9c9] bg-white p-4">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <label>
                        <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">RECIPE NAME</span>
                        <input value={recipeDraft.name} onChange={(e) => setRecipeDraft({ ...recipeDraft, name: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black" />
                      </label>

                      <label>
                        <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">YIELD QTY</span>
                        <input value={recipeDraft.yield_qty} onChange={(e) => setRecipeDraft({ ...recipeDraft, yield_qty: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 text-black" />
                      </label>

                      <label>
                        <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">YIELD UNIT</span>
                        <input value={recipeDraft.yield_unit} onChange={(e) => setRecipeDraft({ ...recipeDraft, yield_unit: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 text-black" />
                      </label>

                      <label>
                        <span className="mb-1 block text-[10px] font-black uppercase text-[#444]">WASTE %</span>
                        <input value={recipeDraft.waste_pct} onChange={(e) => setRecipeDraft({ ...recipeDraft, waste_pct: e.target.value })} className="w-full rounded-[8px] border border-[#aaa] px-3 py-3 text-black" />
                      </label>
                    </div>
                  </section>

                  <LineTable title="INGREDIENTS" lines={ingredientsWithIndex} />
                  <LineTable title="UTILITY & PREP COST" lines={utilityWithIndex} utilityMode />
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
