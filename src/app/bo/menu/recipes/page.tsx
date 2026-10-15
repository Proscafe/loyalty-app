import { requireRole } from "@/lib/auth";
import { RecipeManager } from "../../RecipeManager";

export const dynamic = "force-dynamic";

export default async function MenuRecipesPage() {
  await requireRole(["master_admin"]);
  return <RecipeManager kind="menu" title="MENU RECIPES" active="/bo/menu" />;
}
