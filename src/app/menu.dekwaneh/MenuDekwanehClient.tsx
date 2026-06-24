"use client";

import { useMemo, useState } from "react";
import menuData from "./pros-menu-dekwaneh.json";

type MenuCategory = {
  id: string;
  name: string;
  image?: string;
};

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  arabicName?: string;
  description?: string;
  price?: string;
  image?: string;
};

function safeImage(value?: string) {
  return value && value.trim().length > 0 ? value : "/pros-logo-basic.png";
}

function safeId(value: string | undefined, fallback: string) {
  const cleaned = String(value || "").trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

export default function MenuDekwanehClient() {
  const rawCategories = menuData.categories as MenuCategory[];
  const rawItems = menuData.items as MenuItem[];

  const categories = useMemo(
    () =>
      rawCategories.map((category, index) => ({
        ...category,
        id: safeId(category.id, `category-${index + 1}`),
        name: category.name?.trim() || `Category ${index + 1}`,
      })),
    [rawCategories],
  );

  const items = useMemo(
    () =>
      rawItems.map((item, index) => ({
        ...item,
        id: safeId(item.id, `item-${index + 1}`),
        categoryId: safeId(item.categoryId, categories[0]?.id || "category-1"),
      })),
    [rawItems, categories],
  );

  const categoryWithItems = categories.find((category) =>
    items.some((item) => item.categoryId === category.id),
  );
  const defaultCategory = categoryWithItems?.id ?? categories[0]?.id ?? "";
  const [activeCategoryId, setActiveCategoryId] = useState(defaultCategory);

  const activeCategory = categories.find((category) => category.id === activeCategoryId) ?? categories[0];
  const visibleItems = useMemo(
    () => items.filter((item) => item.categoryId === activeCategoryId),
    [activeCategoryId, items],
  );

  return (
    <main className="min-h-screen bg-[#ededed] text-[#101418]" style={{ fontFamily: "Inter, Arial, Helvetica, sans-serif" }}>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#ededed]/95 px-4 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/pros-logo-basic.png" alt="PRO's Cafe" className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-[18px] font-black tracking-[-0.04em] text-[#13202a]">PRO&apos;s Cafe</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#d66c11]">Dekwaneh Menu</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="sticky top-[73px] z-10 overflow-x-auto bg-[#ededed]/95 px-3 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-5xl gap-3">
          {categories.map((category, index) => {
            const categoryKey = `${category.id}-${index}`;
            const active = category.id === activeCategoryId;
            return (
              <button
                key={categoryKey}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 pr-5 text-[13px] font-bold shadow-sm transition ${
                  active ? "bg-white text-[#13202a] ring-2 ring-[#d66c11]/40" : "bg-[#e1e1e1] text-[#24323a] hover:bg-white"
                }`}
              >
                <span className="flex h-8 w-8 overflow-hidden rounded-full bg-white shadow-inner">
                  <img src={safeImage(category.image)} alt="" className="h-full w-full object-cover" />
                </span>
                {category.name}
              </button>
            );
          })}
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-7 pb-12 pt-2 sm:px-8">
        <div className="mb-7">
          <h2 className="font-serif text-[31px] font-black uppercase tracking-[-0.05em] text-[#08111a] sm:text-[40px]">
            {activeCategory?.name ?? "Menu"}
          </h2>
          <div className="mt-2 h-[3px] w-11 rounded-full bg-[#ee790f]" />
        </div>

        <div className="grid gap-4">
          {visibleItems.map((item, index) => (
            <article
              key={`${item.id}-${index}`}
              className="group flex items-center gap-4 rounded-[18px] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(16,24,32,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(16,24,32,0.12)]"
            >
              <img
                src={safeImage(item.image)}
                alt={item.name}
                className="h-[86px] w-[86px] shrink-0 rounded-[13px] object-cover shadow-sm sm:h-[96px] sm:w-[120px]"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[16px] font-bold text-[#1b2328] sm:text-[18px]">
                  {item.name}{item.arabicName ? ` - ${item.arabicName}` : ""}
                </h3>
                <p className="mt-2 line-clamp-1 text-[13px] font-medium text-[#aaa2a0] sm:text-[14px]">
                  {item.description || "Freshly prepared at PRO's Cafe."}
                </p>
                <div className="mt-3 text-[17px] font-black text-[#111] sm:text-[18px]">
                  {item.price || "—"}
                </div>
              </div>
              <div className="shrink-0 text-[24px] font-light text-[#cfc8c3] transition group-hover:translate-x-1 group-hover:text-[#ee790f]">›</div>
            </article>
          ))}

          {visibleItems.length === 0 ? (
            <div className="rounded-[18px] bg-white px-5 py-10 text-center text-[14px] font-bold text-[#7b7773] shadow-[0_10px_24px_rgba(16,24,32,0.08)]">
No items found in this category yet. Run the scraper again, then refresh.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
