"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BOFrame } from "./BOFrame";
import { moneyLbp } from "./format";
import { SearchablePicker } from "./SearchablePicker";

type Row = Record<string, any>;

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

function n(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

export function RecipeManager({
  kind,
  title,
  active,
  toolbar,
}: {
  kind: "sauce" | "prep" | "menu";
  title: string;
  active: string;
  toolbar?: React.ReactNode;
}) {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/bo/recipes?kind=${kind}`, { cache: "no-store" });
    const json = await res.json();

    if (!res.ok) setError(json?.error || "Unable to load recipes.");
    else setData(json);
  }

  useEffect(() => {
    void load();
  }, [kind]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.recipes ?? []).filter(
      (row: Row) => !q || String(row.name).toLowerCase().includes(q),
    );
  }, [data, search]);

  const ingredients: Row[] = data?.ingredients ?? [];
  const utilities: Row[] = data?.utilities ?? [];
  const allRecipes: Row[] = data?.all_recipes ?? [];

  function newRecipe() {
    setEditing(null);
    setDraft({
      name: "",
      kind,
      menu_category_id: "",
      yield_qty: "",
      yield_mode: "fixed",
      yield_unit: "",
      waste_pct: "0",
      notes: "",
      lines: [],
    });
    setOpen(true);
    setError("");
  }

  function editRecipe(row: Row) {
    setEditing(row);
    setDraft({
      id: row.id,
      name: row.name ?? "",
      kind: row.kind ?? kind,
      menu_category_id: row.menu_category_id ? String(row.menu_category_id) : "",
      yield_qty: row.yield_qty ?? "",
      yield_mode: row.yield_mode ?? "fixed",
      yield_unit: row.yield_unit ?? "",
      waste_pct: row.waste_pct ?? "0",
      notes: row.notes ?? "",
      lines: (row.lines ?? []).map((line: Row) => ({
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
    setOpen(true);
    setError("");
  }

  function addLine(type: "ingredient" | "recipe" | "utility" | "fixed") {
    if (!draft) return;

    setDraft({
      ...draft,
      lines: [
        ...draft.lines,
        {
          ...EMPTY_LINE,
          line_type: type,
          section: type === "utility" || type === "fixed" ? "utility" : "primary",
        },
      ],
    });
  }

  function updateLine(index: number, patch: Row) {
    setDraft({
      ...draft,
      lines: draft.lines.map((line: Row, i: number) =>
        i === index ? { ...line, ...patch } : line,
      ),
    });
  }

  function removeLine(index: number) {
    setDraft({
      ...draft,
      lines: draft.lines.filter((_: Row, i: number) => i !== index),
    });
  }

  function source(line: Row) {
    if (line.line_type === "ingredient") {
      const item = ingredients.find((x) => String(x.id) === String(line.ingredient_id));
      return {
        unit: item?.consumption_unit || item?.purchase_unit || "—",
        cost: n(item?.unit_cost_lbp),
      };
    }

    if (line.line_type === "utility") {
      const item = utilities.find((x) => String(x.id) === String(line.utility_id));
      return {
        unit: item?.unit_label || "—",
        cost: n(item?.unit_cost_lbp),
      };
    }

    if (line.line_type === "recipe") {
      const item = allRecipes.find((x) => String(x.id) === String(line.sub_recipe_id));
      return {
        unit: item?.yield_unit || "—",
        cost:
          line.sub_basis === "batch"
            ? n(item?.batch_cost_lbp)
            : n(item?.unit_cost_lbp),
      };
    }

    return {
      unit: line.fixed_currency || "LBP",
      cost: n(line.fixed_price),
    };
  }

  function total(line: Row) {
    const meta = source(line);
    const qty = n(line.qty);
    const factor = n(line.factor) ?? 1;

    if (meta.cost === null || qty === null) return null;
    return meta.cost * qty * factor;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/bo/recipes", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editing?.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Unable to save recipe.");
      }

      await load();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save recipe.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecipe(row: Row) {
    if (!confirm(`Delete "${row.name}"?`)) return;

    const res = await fetch(`/api/bo/recipes?id=${row.id}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) setError(json?.error || "Unable to delete recipe.");
    else await load();
  }

  const ingredientOptions = ingredients.map((x) => ({
    value: String(x.id),
    label: x.name,
  }));

  const utilityOptions = utilities.map((x) => ({
    value: String(x.id),
    label: x.name,
  }));

  const recipeOptions = allRecipes
    .filter((x) => String(x.id) !== String(editing?.id))
    .map((x) => ({
      value: String(x.id),
      label: x.name,
    }));

  return (
    <BOFrame
      active={active}
      title={title}
      subtitle="Edit costing lines directly, with live unit and total costs."
      actions={
        <>
          {toolbar}
          <button
            onClick={newRecipe}
            className="rounded-[10px] bg-black px-4 py-3 text-[11px] font-black uppercase text-white"
          >
            ADD RECIPE
          </button>
        </>
      }
    >
      {error ? (
        <div className="mb-4 rounded-[10px] border border-black/20 bg-white px-4 py-3 text-[12px] font-bold text-black">
          {error}
        </div>
      ) : null}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="SEARCH RECIPE"
        className="mb-4 w-full rounded-[10px] border border-[#bdbdbd] bg-white px-4 py-3 text-[12px] font-bold text-black outline-none focus:border-black"
      />

      <div className="overflow-hidden rounded-[14px] border border-[#c9c9c9] bg-white">
        <table className="w-full text-left">
          <thead className="bg-[#e9e9e9] text-[10px] font-black uppercase text-[#333]">
            <tr>
              <th className="px-4 py-3">RECIPE</th>
              <th className="px-3 py-3">YIELD</th>
              <th className="px-3 py-3 text-right">UNIT COST</th>
              <th className="px-3 py-3 text-right">LINES</th>
              <th className="px-4 py-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: Row) => (
              <tr key={row.id} className="border-t border-black/[0.08] text-[11px] text-black">
                <td className="px-4 py-3 font-black">{row.name}</td>
                <td className="px-3 py-3">{row.yield_qty || "—"} {row.yield_unit || ""}</td>
                <td className="px-3 py-3 text-right font-black">{moneyLbp(row.costing?.unitCost)}</td>
                <td className="px-3 py-3 text-right">{row.lines?.length ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => editRecipe(row)}
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

      {open && draft ? (
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto my-3 w-full max-w-[1380px] overflow-hidden rounded-[20px] border border-[#c7c7c7] bg-[#f5f5f5] shadow-2xl"
          >
            <div className="sticky top-0 z-30 flex items-start justify-between border-b border-[#d0d0d0] bg-white px-6 py-5">
              <div>
                <div className="text-[10px] font-black uppercase text-[#555]">
                  {kind === "sauce" ? "SAUCE COSTING" : kind === "prep" ? "PREP COSTING" : "RECIPE COSTING"}
                </div>
                <h2 className="mt-1 text-[24px] font-black uppercase text-black">
                  {editing ? "EDIT RECIPE" : "ADD RECIPE"}
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
                <div className="grid gap-3 sm:grid-cols-4">
                  <input
                    required
                    placeholder="RECIPE NAME"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="rounded-[8px] border border-[#aaa] px-3 py-3 font-bold text-black sm:col-span-1"
                  />
                  <input
                    placeholder="YIELD QTY"
                    value={draft.yield_qty}
                    onChange={(e) => setDraft({ ...draft, yield_qty: e.target.value })}
                    className="rounded-[8px] border border-[#aaa] px-3 py-3 text-black"
                  />
                  <input
                    placeholder="YIELD UNIT"
                    value={draft.yield_unit}
                    onChange={(e) => setDraft({ ...draft, yield_unit: e.target.value })}
                    className="rounded-[8px] border border-[#aaa] px-3 py-3 text-black"
                  />
                  <input
                    placeholder="WASTE %"
                    value={draft.waste_pct}
                    onChange={(e) => setDraft({ ...draft, waste_pct: e.target.value })}
                    className="rounded-[8px] border border-[#aaa] px-3 py-3 text-black"
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-[14px] border border-[#c9c9c9] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9c9c9] bg-[#e7e7e7] px-4 py-3">
                  <h3 className="text-[12px] font-black uppercase text-black">COSTING ITEMS</h3>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => addLine("ingredient")} className="rounded-[8px] bg-black px-3 py-2 text-[10px] font-black uppercase text-white">
                      ADD INGREDIENT
                    </button>
                    <button type="button" onClick={() => addLine("recipe")} className="rounded-[8px] border border-black/20 bg-white px-3 py-2 text-[10px] font-black uppercase text-black">
                      ADD PREP / SAUCE
                    </button>
                    <button type="button" onClick={() => addLine("utility")} className="rounded-[8px] border border-black/20 bg-white px-3 py-2 text-[10px] font-black uppercase text-black">
                      ADD UTILITY
                    </button>
                    <button type="button" onClick={() => addLine("fixed")} className="rounded-[8px] border border-black/20 bg-white px-3 py-2 text-[10px] font-black uppercase text-black">
                      ADD FIXED COST
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] text-left">
                    <thead className="bg-[#f4f4f4] text-[10px] font-black uppercase text-[#333]">
                      <tr>
                        <th className="p-3">GROUP</th>
                        <th className="p-3">TYPE</th>
                        <th className="p-3">SOURCE</th>
                        <th className="p-3 text-right">QTY</th>
                        <th className="p-3">UNIT</th>
                        <th className="p-3 text-right">UNIT COST</th>
                        <th className="p-3 text-right">FACTOR</th>
                        <th className="p-3 text-right">TOTAL COST</th>
                        <th className="p-3">REMARK</th>
                        <th className="p-3 text-right">ACTION</th>
                      </tr>
                    </thead>

                    <tbody>
                      {draft.lines.map((line: Row, index: number) => {
                        const meta = source(line);
                        const rowTotal = total(line);

                        return (
                          <tr key={index} className="border-t border-black/[0.08] text-[11px] text-black">
                            <td className="p-2">
                              <select value={line.section} onChange={(e) => updateLine(index, { section: e.target.value })} className="w-full rounded-[7px] border border-[#aaa] px-2 py-2 font-bold">
                                <option value="primary">PRIMARY</option>
                                <option value="secondary">SECONDARY</option>
                                <option value="utility">UTILITY</option>
                                <option value="main">OTHER</option>
                              </select>
                            </td>

                            <td className="p-2">
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
                                className="w-full rounded-[7px] border border-[#aaa] px-2 py-2 font-bold"
                              >
                                <option value="ingredient">INGREDIENT</option>
                                <option value="recipe">PREP / SAUCE</option>
                                <option value="utility">UTILITY</option>
                                <option value="fixed">FIXED</option>
                              </select>
                            </td>

                            <td className="p-2">
                              {line.line_type === "ingredient" ? (
                                <SearchablePicker
                                  value={line.ingredient_id}
                                  options={ingredientOptions}
                                  placeholder="TYPE INGREDIENT NAME..."
                                  onChange={(value) => updateLine(index, { ingredient_id: value })}
                                />
                              ) : line.line_type === "recipe" ? (
                                <SearchablePicker
                                  value={line.sub_recipe_id}
                                  options={recipeOptions}
                                  placeholder="TYPE PREP / SAUCE NAME..."
                                  onChange={(value) => updateLine(index, { sub_recipe_id: value })}
                                />
                              ) : line.line_type === "utility" ? (
                                <SearchablePicker
                                  value={line.utility_id}
                                  options={utilityOptions}
                                  placeholder="TYPE UTILITY NAME..."
                                  onChange={(value) => updateLine(index, { utility_id: value })}
                                />
                              ) : (
                                <input
                                  value={line.fixed_price}
                                  onChange={(e) => updateLine(index, { fixed_price: e.target.value })}
                                  placeholder="FIXED COST"
                                  className="w-full rounded-[7px] border border-[#aaa] px-3 py-2.5 text-black"
                                />
                              )}
                            </td>

                            <td className="p-2">
                              <input value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} className="w-[84px] rounded-[7px] border border-[#aaa] px-2 py-2 text-right font-bold" />
                            </td>

                            <td className="p-2 font-semibold text-[#555]">{meta.unit}</td>
                            <td className="p-2 text-right font-black">{moneyLbp(meta.cost)}</td>

                            <td className="p-2">
                              <input value={line.factor} onChange={(e) => updateLine(index, { factor: e.target.value })} className="w-[90px] rounded-[7px] border border-[#aaa] px-2 py-2 text-right font-bold" />
                            </td>

                            <td className="p-2 text-right font-black">{moneyLbp(rowTotal)}</td>

                            <td className="p-2">
                              <input value={line.note} onChange={(e) => updateLine(index, { note: e.target.value })} placeholder="REMARK" className="w-full min-w-[150px] rounded-[7px] border border-[#aaa] px-2 py-2" />
                            </td>

                            <td className="p-2 text-right">
                              <button type="button" onClick={() => removeLine(index)} className="rounded-[7px] border border-black/20 px-3 py-2 text-[9px] font-black uppercase hover:bg-black hover:text-white">
                                REMOVE
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 z-30 flex justify-end gap-2 border-t border-[#d0d0d0] bg-white px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] border border-black/20 px-4 py-3 text-[11px] font-black uppercase">
                CANCEL
              </button>
              <button disabled={saving} className="rounded-[9px] bg-black px-5 py-3 text-[11px] font-black uppercase text-white disabled:opacity-50">
                {saving ? "SAVING..." : "SAVE RECIPE"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </BOFrame>
  );
}
