"use client";

import { useEffect, useMemo, useState } from "react";
import menuData from "./pros-menu-dekwaneh.json";

type MenuCategory = {
  id?: string;
  name?: string;
  image?: string;
};

type MenuItem = {
  id?: string;
  categoryId?: string;
  name?: string;
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

function normalizeLabel(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function normalizePrice(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = text.match(/(\d[\d,.\s]*)\s*(?:L\.?\s*L\.?|LL|LBP|ل\.?\s*ل\.?)\b/i);
  if (!match) return text;

  let digits = match[1].replace(/\D/g, "");

  if (digits.length % 2 === 0) {
    const half = digits.length / 2;
    const first = digits.slice(0, half);
    const second = digits.slice(half);
    if (first === second) digits = first;
  }

  return digits ? `${digits} L.L` : text;
}

function isBadMenuName(value?: string) {
  const name = String(value || "").trim();
  if (!name) return true;

  const letters = name.replace(/[^\p{Letter}]/gu, "");
  const digits = name.replace(/\D/g, "");

  if (letters.length === 0 && digits.length > 0) return true;
  if (/^\d+[\d\s,.]*$/i.test(name)) return true;
  if (/^\d+[\d\s,.]*(and|&)?\s*$/i.test(name)) return true;
  if (digits.length >= 5 && letters.length <= 3) return true;

  return false;
}

function categoryMatches(itemCategoryId: string, category: { id: string; name: string }) {
  const itemId = normalizeLabel(itemCategoryId);
  const categoryId = normalizeLabel(category.id);
  const categoryName = normalizeLabel(category.name);

  return itemId === categoryId || itemId === categoryName;
}

export default function MenuDekwanehClient() {
  const rawCategories = ((menuData as { categories?: MenuCategory[] }).categories || []) as MenuCategory[];
  const rawItems = ((menuData as { items?: MenuItem[] }).items || []) as MenuItem[];

  const categories = useMemo(() => {
    const mapped = rawCategories.map((category, index) => {
      const name = String(category.name || "").trim() || `Category ${index + 1}`;
      return {
        ...category,
        id: safeId(category.id, normalizeLabel(name) || `category-${index + 1}`),
        name,
      };
    });

    return mapped.length > 0 ? mapped : [{ id: "menu", name: "Menu", image: "" }];
  }, [rawCategories]);

  const items = useMemo(
    () =>
      rawItems
        .map((item, index) => {
          const name = String(item.name || "").replace(/\s+/g, " ").trim();
          const rawCategoryId = String(item.categoryId || "").trim();
          const categoryId = rawCategoryId || categories[0]?.id || "menu";

          return {
            ...item,
            id: safeId(item.id, `item-${index + 1}`),
            categoryId,
            name,
            arabicName: String(item.arabicName || "").replace(/\s+/g, " ").trim(),
            description: String(item.description || "").replace(/\s+/g, " ").trim(),
            price: normalizePrice(item.price),
          };
        })
        .filter((item) => !isBadMenuName(item.name)),
    [rawItems, categories],
  );

  const visibleCategories = useMemo(() => {
    if (items.length === 0) return categories;

    const withItems = categories.filter((category) =>
      items.some((item) => categoryMatches(item.categoryId || "", category)),
    );

    return withItems.length > 0 ? withItems : categories;
  }, [categories, items]);

  const firstCategoryId = visibleCategories[0]?.id || "menu";
  const [activeCategoryId, setActiveCategoryId] = useState(firstCategoryId);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (!visibleCategories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(firstCategoryId);
    }
  }, [activeCategoryId, firstCategoryId, visibleCategories]);

  const activeCategory = visibleCategories.find((category) => category.id === activeCategoryId) ?? visibleCategories[0];
  const visibleItems = useMemo(() => {
    if (!activeCategory) return [];
    return items.filter((item) => categoryMatches(item.categoryId || "", activeCategory));
  }, [activeCategory, items]);

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
          {visibleCategories.map((category, index) => {
            const active = category.id === activeCategoryId;
            return (
              <button
                key={`${category.id || category.name || "category"}-${index}`}
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

      <section className="mx-auto max-w-5xl px-4 pb-12 pt-2 sm:px-8">
        <div className="mb-6 sm:mb-7">
          <h2 className="font-serif text-[31px] font-black uppercase tracking-[-0.05em] text-[#08111a] sm:text-[40px]">
            {activeCategory?.name ?? "Menu"}
          </h2>
          <div className="mt-2 h-[3px] w-11 rounded-full bg-[#ee790f]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {visibleItems.map((item, index) => (
            <article
              key={`${item.id || item.name || "item"}-${index}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedItem(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedItem(item);
                }
              }}
              className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-[18px] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(16,24,32,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(16,24,32,0.12)] sm:gap-4 sm:px-4 sm:py-4 lg:flex-row"
            >
              <button
                type="button"
                aria-label={`Open image for ${item.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedImage({ src: safeImage(item.image), alt: item.name || "Menu item" });
                }}
                className="shrink-0 overflow-hidden rounded-[13px] focus:outline-none focus:ring-2 focus:ring-[#ee790f]/60"
              >
                <img
                  src={safeImage(item.image)}
                  alt={item.name || "Menu item"}
                  className="h-[78px] w-[78px] object-cover shadow-sm transition duration-200 group-hover:scale-[1.02] sm:h-[96px] sm:w-[112px] lg:w-[120px]"
                />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 break-words text-[15px] font-black leading-tight text-[#1b2328] sm:text-[17px]">
                  {item.name}{item.arabicName ? ` - ${item.arabicName}` : ""}
                </h3>
                <p className="mt-2 line-clamp-2 break-words text-[12px] font-medium leading-snug text-[#9b9491] sm:text-[14px]">
                  {item.description || "Freshly prepared at PRO's Cafe."}
                </p>
                <div className="mt-3 text-[16px] font-black text-[#111] sm:text-[18px]">
                  {item.price || "—"}
                </div>
              </div>
              <div className="hidden shrink-0 text-[24px] font-light text-[#cfc8c3] transition group-hover:translate-x-1 group-hover:text-[#ee790f] sm:block">›</div>
            </article>
          ))}

          {visibleItems.length === 0 ? (
            <div className="rounded-[18px] bg-white px-5 py-10 text-center text-[14px] font-bold text-[#7b7773] shadow-[0_10px_24px_rgba(16,24,32,0.08)] sm:col-span-2 lg:col-span-1">
              No valid items found in this category yet. Run the scraper again, then refresh.
            </div>
          ) : null}
        </div>
      </section>

      {selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[26px] font-light text-[#111] shadow-lg"
            onClick={() => setSelectedImage(null)}
          >
            ×
          </button>
          <img
            src={selectedImage.src}
            alt={selectedImage.alt}
            className="max-h-[82vh] max-w-[92vw] rounded-[24px] bg-white object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <article
            className="relative max-h-[90vh] w-full max-w-[720px] overflow-hidden rounded-[28px] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close item details"
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[26px] font-light text-[#111] shadow-lg"
              onClick={() => setSelectedItem(null)}
            >
              ×
            </button>
            <button
              type="button"
              aria-label={`Open larger image for ${selectedItem.name}`}
              className="block h-[280px] w-full bg-[#f4f4f4] sm:h-[360px]"
              onClick={() => setSelectedImage({ src: safeImage(selectedItem.image), alt: selectedItem.name || "Menu item" })}
            >
              <img
                src={safeImage(selectedItem.image)}
                alt={selectedItem.name || "Menu item"}
                className="h-full w-full object-cover"
              />
            </button>
            <div className="max-h-[42vh] overflow-y-auto px-5 pb-6 pt-5 sm:px-7 sm:pb-8">
              <h3 className="break-words text-[24px] font-black leading-tight tracking-[-0.04em] text-[#111] sm:text-[32px]">
                {selectedItem.name}
              </h3>
              {selectedItem.arabicName ? (
                <p className="mt-2 text-[18px] font-bold text-[#d66c11]" dir="auto">{selectedItem.arabicName}</p>
              ) : null}
              <p className="mt-4 break-words text-[15px] font-medium leading-7 text-[#77706d] sm:text-[16px]">
                {selectedItem.description || "Freshly prepared at PRO's Cafe."}
              </p>
              <div className="mt-5 inline-flex rounded-full bg-[#fff2df] px-5 py-3 text-[20px] font-black text-[#111]">
                {selectedItem.price || "—"}
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
