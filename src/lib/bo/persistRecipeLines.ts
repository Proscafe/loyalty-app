// Preserve recipe-line IDs while saving, so review flags and cross-page references stay stable.
export async function persistBoRecipeLines(
  admin: any, recipeId: number, incoming: any[], rows: any[],
) {
  const { data: existing, error: lookupError } = await admin.from("bo_recipe_lines")
    .select("id").eq("recipe_id", recipeId);
  if (lookupError) throw lookupError;
  const known = new Set<number>((existing ?? []).map((r: any): number => Number(r.id)));
  const keep = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const requestedId = Number(incoming[i]?.id);
    if (Number.isSafeInteger(requestedId) && known.has(requestedId) && !keep.has(requestedId)) {
      const { data, error } = await admin.from("bo_recipe_lines")
        .update(rows[i]).eq("id", requestedId).eq("recipe_id", recipeId)
        .select("id").maybeSingle();
      if (error) throw new Error(`Recipe row ${i + 1} update: ${error.message}`);
      if (!data) throw new Error(`Recipe row ${i + 1}: existing row could not be updated.`);
      keep.add(requestedId);
    } else {
      const { data, error } = await admin.from("bo_recipe_lines")
        .insert(rows[i]).select("id").single();
      if (error) throw new Error(`Recipe row ${i + 1} insert: ${error.message}`);
      keep.add(Number(data.id));
    }
  }
  // Delete only rows explicitly removed from the editor.
  const removed = [...known].filter(id => !keep.has(id));
  if (removed.length) {
    const { error } = await admin.from("bo_recipe_lines")
      .delete().eq("recipe_id", recipeId).in("id", removed);
    if (error) throw new Error(`Unable to remove deleted recipe rows: ${error.message}`);
  }
  // Read back the full saved rows, including flags and linked preparation IDs.
  const saved: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("bo_recipe_lines").select("*")
      .eq("recipe_id", recipeId).order("sort").order("id").range(offset, offset + 499);
    if (error) throw error;
    saved.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  if (saved.length !== rows.length) {
    throw new Error(`Recipe save incomplete: expected ${rows.length} lines, found ${saved.length}.`);
  }
  for (let i = 0; i < rows.length; i++) {
    const expected = rows[i];
    const actual = saved[i];
    const fields = ["line_type", "ingredient_id", "sub_recipe_id", "utility_id", "qty", "needs_review", ...(expected.line_type === "recipe" ? ["sub_cost_basis"] : [])];
    // `rows` are the normalized values written to the DB; never compare against
    // the draft (`incoming`), which may omit newly introduced fields.
    const mismatch = fields.find(field => {
      if (field === "sub_cost_basis") {
        // The UI may not submit this legacy optional field. Newly linked
        // recipes are always ingredients-only; normalize both sides.
        const expectedBasis = "ingredients"; // All linked recipe costs exclude utility/fixed costs.
        const actualBasis = actual?.sub_cost_basis ?? "full";
        return String(actualBasis) !== String(expectedBasis);
      }
      if (field === "qty") return Math.abs(Number(actual?.qty ?? 0) - Number(expected?.qty ?? 0)) > 0.0000001;
      if (field === "needs_review") return (actual?.needs_review === true) !== (expected?.needs_review === true);
      return String(actual?.[field] ?? "") !== String(expected?.[field] ?? "");
    });
    if (mismatch) {
      if (mismatch === "sub_cost_basis") {
        throw new Error(`Recipe row ${i + 1} (${expected.label}) has cost basis ${JSON.stringify(actual?.sub_cost_basis)} in Supabase; expected "ingredients". Confirm the linked-recipe SQL migration is installed and deploy all save-route files together.`);
      }
      throw new Error(`Recipe row ${i + 1} (${expected.label}) did not save its ${mismatch}: expected ${JSON.stringify(expected[mismatch])}, database has ${JSON.stringify(actual?.[mismatch])}.`);
    }
  }
  return saved;
}
