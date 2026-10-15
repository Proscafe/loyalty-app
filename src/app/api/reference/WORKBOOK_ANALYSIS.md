# Workbook analysis — `_Pro's Cost Form WEB.xlsx`

All 28 worksheets were read, including the hidden ones: BAR, Live Rate, CON D and ENG MENU TEMPLATE.

## Import result

| | Count |
|---|---|
| Worksheets read | 28 |
| F&B ingredients / categories | 327 / 18 (includes the HOOKA supply list and BAR purchase list) |
| Sauces (SAUCES sheet) | 35 |
| Preparations (Prep sheet + BAR coffee/cocktail and BIRTHDAYS mini-recipes) | 24 |
| Menu recipes | 292 |
| Menu items | 356, of which 212 appear on Cover D in 14 original sections |
| Utility costs | 6 |
| Recipe lines | 2,918 |

The 292 menu recipes break down as:
* 258 "DISH NAME" blocks across 17 sheets
* 21 BAR items
* 9 combos
* 1 birthday package
* 3 one-line Cover D items

The 2,918 recipe lines break down by type as:
* 1,521 F&B ingredient
* 310 sub-recipe
* 574 utility
* 420 fixed amount
* 93 unresolved

**Verification at the workbook's own rate.** F&B uses ×9,000, so the comparison was run at that rate.
* All 52 recipe totals that have a stored value match exactly, with zero mismatches.
* All 2,187 recipe lines that have a stored value match exactly, with zero mismatches.
* 731 lines cannot be verified because the workbook itself stores `#REF!` for them, mostly through the broken UTL rate cell.

Menu items per category:

| Category | Items | Category | Items |
|---|---|---|---|
| STARTERS | 31 | LEBANESE | 14 |
| SALADS | 25 | MANAKISH | 22 |
| HALF SALADS | 25 | RICE MEALS | 5 |
| PIZZA | 12 | KIDS MENU | 9 |
| PASTA | 10 | DESSERTS | 31 |
| BURGERS | 13 | Ramadan | 6 |
| MAINS | 19 | LENT | 12 |
| SANDWICHES | 22 | COMBOS | 9 |
| WRAP | 6 | BIRTHDAYS | 1 |
| BAR | 21 | HOOKA | 3 |

## Sheet → application mapping

| Sheet | Structure found | Becomes |
|---|---|---|
| Cover D | Sections; each item row has SP USD (B), SP LBP = B×90000 (C), cost link to a menu sheet (E), cost % (F), net profit (G), current price = C×(1+H4) (H), and profit/cost % at that price (I–K) | Cover D dashboard. Each row is linked live to its recipe. H4 = 10% becomes the "price adjustment" setting. |
| F&B | Category header rows; Item, Unit, Qty, Unit Price $, LBP = $×9000, Total, Supplier, Brand | F&B ingredients, categories and suppliers. The USD price is stored; LBP uses the central rate. |
| SAUCES / Prep | Side-by-side blocks: name, yield and unit, cost per unit, USD; then Name / Qty / Unit Price / Total lines; TOTAL; "Selling Price 45 Grs" portion row | One recipe per block. Portion size (0.045) and portion price are kept. |
| UTL COST | Shortening Oil = F&B price × 0.0075; Gas = Gas-Count table ($13×10 + $38×30) × C1 ÷ 7000; Electricity 3260×C1 ÷ 45000; Wood 180×C1 ÷ 525; Gas Pizza (35×4)×C1 ÷ 450; Labor 180,000,000 ÷ 22000 | Utility costs. Shortening oil stays linked to F&B. Labor is imported, but no recipe used it in the workbook. |
| 17 menu sheets | "DISH NAME" blocks (2–3 across): EST. SALE PRICE, TOTAL COST, Primary / Secondary / Utility sections | One menu recipe per block, sections preserved. The sheet's own estimated price is kept for reference. |
| BAR (hidden) | USD box prices, qty per box, electricity, extra (nuts), selling price; coffee/cocktail mini-recipes | Ingredients in a BAR category, plus 21 menu items and their recipes. |
| COMBOS | Combo blocks: components (selling price, cost link), combo price, hard-coded combo cost | 9 combo menu items. Every component cost link in the workbook is `#REF!`, so these are listed for re-linking. |
| BIRTHDAYS | Package lines with mostly `#REF!` costs; mini-sandwich and mini-burger sub-blocks in USD | 1 package item plus 2 preparations, flagged for review. |
| HOOKA | Menu blocks plus a supply price list (USD × rate) | 3 menu items, plus the supply list as ingredients. |
| Live Rate (hidden) | Scraped LBP rates (latest: 89,700 buy on 2023-11-10) | Reference only; a single central rate replaces it. |
| CON D (hidden) | Consumption estimate (sales × key ingredient qty); item names are `#REF!` (deleted "ENG MENU D" sheet) | Rebuilt as **Reports → Consumption**, expanded through every sub-recipe. |
| ENG MENU TEMPLATE (hidden) | Menu engineering (80% popularity rule, profit vs average → Star/Workhorse/Challenge/Dog); references are `#REF!` | Rebuilt as **Reports → Menu engineering** on live costs. |

## How lines were linked

Each line's Total Cost formula is reduced symbolically through every intermediate cell to
**source × factor**. For example, `C22 = $C$4`, `C4 = 'F&B'!$F$250` and `D = B*C` resolve to
Mayonnaise × 1, and `'F&B'!$F$57/18` resolves to Sunflower Oil × 1/18. The factor is stored on the
line, so the price itself stays only in F&B.

Workbook semantics that are preserved:
* A section TOTAL typed as a number or left empty: the rows above it were not counted, and still aren't. Affects 3 recipes.
* A TOTAL whose SUM range skips a row: that row is excluded. Affects 5 cases.
* A yield computed with `SUM()` over part of the rows (Mushroom Sauce): only those rows count toward the yield.
* Hard-coded amounts are kept as fixed lines and flagged.
* An empty quantity is kept as "missing quantity". It is not converted to zero cost.

## Problems found in the workbook (all listed in Reports → Review queue)

1. **Exchange rate (assumption, please confirm).**
   * F&B converts at **×9,000**.
   * Cover D, the menu sheets and the recipe headers use **90,000**.
   * Live Rate shows 89,700.

   The ×9,000 makes ingredient costs 10 times too low against selling prices. For example, Caesar Sauce comes out at $0.84/kg instead of about $8.41/kg. The app uses one central rate, set by default to **90,000**.
2. **`UTL COST!C1` is `#REF!` (assumption, please confirm).** Gas, Electricity, Wood and Gas Pizza multiply a USD amount by this cell. It is read as the exchange rate. This one broken cell turned most menu totals in the workbook into `#REF!`.
3. **91 rows priced from a different ingredient than their label.** Examples:
   * Prep "Salt" is priced from Eggs, and "Sugar" from Onions.
   * Spinach Dip "Flour" is priced from Tomato.
   * Lebanese "Lemon Juice" is priced from black olives.
   * Kids "French Fries" is priced from Nuggets.
   * A burger's "Honey Mustard" is priced from French Fries.
   * Utility rows labelled "Gas" use Shortening Oil.
4. **43 ingredients converted with different factors in different recipes.** Examples:
   * Salt is ÷25 in some recipes and ×1 in others. F&B lists "SALT 1KG" at $6.50, which looks like a 25 kg bag price.
   * Sunflower oil is ÷18 and ÷8.
   * Ketchup is ÷13 and ÷4.
5. **Missing data.**
   * 62 missing or zero prices.
   * 17 lines with no quantity.
   * 3 recipes with no yield: Honey Citrus, Croutons (Prep A1, which is empty), and Green Salad.
6. **Cover D formula problems.**
   * The Sauce Cup rows compute SP LBP = B ÷ 90,000 instead of × 90,000.
   * The Drinks rows add pairs of unrelated HOOKA cells that shift down one row each time.
   * Some "Current Price" cells are `#REF!`.
   * 13 items have no cost formula.
   * "Onion Rings" points at the block named "Skillet Tender".
7. **Broken references with nothing to recover.**
   * COMBOS and BIRTHDAYS components are `#REF!`.
   * Prep "Ajenet Knefe" has 4 ingredient rows that are `#REF!`.
   * SAUCES "Burger Patty" links to an external workbook.
   * "Hommos" and "Moutabal" have a Gas row that is `#REF!`.

   These lines are imported as **unresolved** and need to be re-linked in the recipe editor. Their recipes show as partial until then.
8. **Non-standard unit-cost formulas.**
   * Chicken Quesadillas divides the batch cost by 10 even though its yield cell says 1.55 KG.
   * Vine Leaves uses a custom formula.
   * Sambousik and Cheese Rolls divide the label cost by the yield twice.

   These are flagged on the recipe.
9. **Repeated hard-coded 0.1** in the "Water" utility row of 240 menu recipes. This row sits beside the Wood reference, so Wood is used by no recipe.

## Data model (server/src/db.ts)

The schema has these tables:

* **Reference data:** `settings`, `exchange_rate_history`, `units`, `suppliers`, `ingredient_categories`.
* **Ingredients:** `ingredients`, which holds the price, its currency, pack content and the consumption unit. Price changes go to `ingredient_price_history`.
* **Utilities:** `utilities`, which works either as a share of an F&B item or as a period pool. Related tables are `utility_count_lines` and `utility_history`.
* **Recipes:** `recipes`, with kind sauce, prep or menu, plus yield, waste and portion. Each recipe's lines are in `recipe_lines`. A line has a type (ingredient, recipe, utility, fixed or unresolved), a foreign key to its source, a qty and a factor. It also keeps its source cell and formula for traceability.
* **Menu:** `menu_categories`, `cover_sections`, `menu_items` (recipe and factor, SP USD, Cover D position), `menu_price_history`, `menu_sales`.
* **Import tracking:** `import_logs`, `validation_issues`.

All relationships use integer IDs with foreign keys. Ingredients, recipes and utilities that
are in use are protected from deletion (`ON DELETE RESTRICT`, and checked in the API with a
clear message). Imported records carry `source_ref` (sheet!cell), so a re-import updates them
instead of creating duplicates.
