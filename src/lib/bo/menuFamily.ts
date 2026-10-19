/** Parent family for menu categories. Category IDs and recipes remain unchanged. */
export const MENU_FAMILIES = ["Food", "Beverage", "Hooka"] as const;
export type MenuFamily = (typeof MENU_FAMILIES)[number];
export function menuFamily(name: unknown): MenuFamily {
  if (name && typeof name === "object" && "family" in name) {
    const explicit = (name as { family?: unknown }).family;
    if (explicit === "Food" || explicit === "Beverage" || explicit === "Hooka") return explicit;
    name = (name as { name?: unknown }).name;
  }
  const normalized = String(name ?? "").trim().toUpperCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (normalized === "DRINKS HOT" || normalized === "DRINKS COLD") return "Beverage";
  if (normalized === "HOOKA" || normalized === "HOOKAH") return "Hooka";
  return "Food";
}
export function categoriesInFamily<T extends { name: string }>(categories: T[], family: MenuFamily): T[] {
  return categories.filter(c => menuFamily(c.name) === family);
}
