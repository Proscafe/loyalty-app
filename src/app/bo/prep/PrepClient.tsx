"use client";

import { useState } from "react";
import { RecipeManager } from "../RecipeManager";

export function PrepClient() {
  const [tab, setTab] = useState<"sauce" | "prep">("sauce");

  const toolbar = (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setTab("sauce")}
        className={`rounded-[10px] px-3 py-3 text-[10px] font-black uppercase ${
          tab === "sauce" ? "bg-white text-[#26382d]" : "bg-white/8 text-white"
        }`}
      >
        SAUCES
      </button>
      <button
        type="button"
        onClick={() => setTab("prep")}
        className={`rounded-[10px] px-3 py-3 text-[10px] font-black uppercase ${
          tab === "prep" ? "bg-white text-[#26382d]" : "bg-white/8 text-white"
        }`}
      >
        PREPARATIONS
      </button>
    </div>
  );

  return (
    <RecipeManager
      key={tab}
      kind={tab}
      title="PREP & SAUCES"
      active="/bo/prep"
      toolbar={toolbar}
    />
  );
}
