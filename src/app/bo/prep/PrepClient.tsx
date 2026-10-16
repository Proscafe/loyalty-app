"use client";
import { useState } from "react";
import { RecipeManager } from "../RecipeManager";
export function PrepClient() {
  const [kind, setKind] = useState<"prep" | "sauce">("prep");
  return <RecipeManager key={kind} kind={kind} title="PRODUCTION" active="/bo/prep" toolbar={
    <select aria-label="Production category" value={kind} onChange={e => setKind(e.target.value as "prep" | "sauce")} className="rounded-md border border-black/20 bg-white px-3 py-2 text-[11px] font-bold text-black">
      <option value="prep">PREPARATIONS</option><option value="sauce">SAUCES</option>
    </select>
  } />;
}
