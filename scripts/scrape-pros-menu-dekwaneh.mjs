import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://shark-accounting.com/menu/Pros_cafe_dekwaneh/index.php?category_id=1562";
const OUTPUT_PATH = path.join(process.cwd(), "src/app/menu.dekwaneh/pros-menu-dekwaneh.json");

function normalizeId(value, fallback = "menu") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
}

function cleanPrice(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = text.match(/(\d[\d,.\s]*)\s*(?:L\.?\s*L\.?|LL|LBP|ل\.?\s*ل\.?)\b/i);
  if (!match) return "";

  let digits = match[1].replace(/\D/g, "");
  if (digits.length % 2 === 0) {
    const half = digits.length / 2;
    const first = digits.slice(0, half);
    const second = digits.slice(half);
    if (first === second) digits = first;
  }

  return digits ? `${digits} L.L` : "";
}

function isBadTitle(value) {
  const title = String(value || "").trim();
  if (!title) return true;

  const letters = title.replace(/[^\p{Letter}]/gu, "");
  const digits = title.replace(/\D/g, "");

  if (letters.length === 0 && digits.length > 0) return true;
  if (/^\d+[\d\s,.]*$/i.test(title)) return true;
  if (/^\d+[\d\s,.]*(and|&)?\s*$/i.test(title)) return true;
  if (digits.length >= 5 && letters.length <= 3) return true;

  return false;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readExistingMenu() {
  try {
    const text = await fs.readFile(OUTPUT_PATH, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractCategories(page) {
  const raw = await page.evaluate(() => {
    const abs = (value) => {
      try {
        return value ? new URL(value, window.location.href).href : "";
      } catch {
        return value || "";
      }
    };

    const links = Array.from(document.querySelectorAll("a[href*='category_id'], button, .category, [class*='category']"));

    return links
      .map((element, index) => {
        const href = element.getAttribute("href") || "";
        const url = href ? abs(href) : "";
        const text = (element.textContent || "").trim().replace(/\s+/g, " ");
        const image = element.querySelector("img")?.getAttribute("src") || "";
        let sourceId = "";
        try {
          sourceId = url ? new URL(url).searchParams.get("category_id") || "" : "";
        } catch {}
        return { sourceId: sourceId || `category-${index + 1}`, name: text, image: abs(image), url };
      })
      .filter((category) => category.name && category.name.length <= 45);
  });

  const categories = uniqueBy(raw, (category) => category.sourceId || category.name.toLowerCase())
    .map((category, index) => ({
      ...category,
      id: normalizeId(category.name || category.sourceId, `category-${index + 1}`),
      name: category.name || `Category ${index + 1}`,
      url: category.url || SOURCE_URL,
    }));

  if (categories.length > 0) return categories;

  return [{ id: "menu", sourceId: "1562", name: "MENU", image: "", url: SOURCE_URL }];
}

async function extractItemsFromPage(page, category) {
  const rawItems = await page.evaluate(() => {
    const abs = (value) => {
      try {
        return value ? new URL(value, window.location.href).href : "";
      } catch {
        return value || "";
      }
    };

    const priceRegex = /(?:\d[\d,.\s]*)\s*(?:L\.?\s*L\.?|LL|LBP|ل\.?\s*ل\.?)\b/i;
    const preferredCards = Array.from(document.querySelectorAll(".item, .product, .card, article, li, [class*='item'], [class*='product'], [class*='meal'], [class*='dish'], [class*='food']"));

    const priceCards = Array.from(document.querySelectorAll("body *"))
      .filter((element) => priceRegex.test((element.textContent || "").replace(/\s+/g, " ")))
      .map((element) => {
        let best = element;
        let current = element;
        for (let depth = 0; depth < 5 && current; depth += 1) {
          const text = (current.textContent || "").replace(/\s+/g, " ").trim();
          if (text.length >= 8 && text.length <= 700 && (current.querySelector("img") || /item|product|card|meal|dish|food/i.test(String(current.className || "")))) {
            best = current;
            break;
          }
          if (text.length >= 8 && text.length <= 500) best = current;
          current = current.parentElement;
        }
        return best;
      });

    const allCards = [...preferredCards, ...priceCards];
    const seen = new Set();

    return allCards
      .map((card, index) => {
        const compactText = (card.textContent || "").trim().replace(/\s+/g, " ");
        if (!compactText || compactText.length < 8 || !priceRegex.test(compactText)) return null;

        const dedupeKey = `${card.tagName}-${String(card.className || "")}-${compactText.slice(0, 160)}`;
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);

        const rawPrice = compactText.match(priceRegex)?.[0] || "";
        const image = card.querySelector("img")?.getAttribute("src") || "";

        const titleElement = card.querySelector("h1,h2,h3,h4,h5,strong,b,[class*='title'],[class*='name']");
        const lines = (card.textContent || "")
          .split(/\n+/)
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .filter((line) => !priceRegex.test(line));

        let title = (titleElement?.textContent || "").trim().replace(/\s+/g, " ");
        if (!title || priceRegex.test(title) || title.length > 90) {
          title = lines.find((line) => line.length >= 2 && line.length <= 90 && /\p{Letter}/u.test(line)) || "";
        }
        if (!title) {
          title = compactText.replace(rawPrice, "").trim().slice(0, 90);
        }

        const description = lines
          .filter((line) => line !== title)
          .join(" ")
          .replace(title, "")
          .replace(rawPrice, "")
          .trim()
          .slice(0, 240);

        return {
          id: `item-${index + 1}`,
          name: title,
          arabicName: "",
          description,
          price: rawPrice,
          image: abs(image),
        };
      })
      .filter(Boolean);
  });

  const items = uniqueBy(rawItems, (item) => `${item.name.toLowerCase()}-${cleanPrice(item.price).toLowerCase()}`)
    .map((item, index) => ({
      ...item,
      price: cleanPrice(item.price),
      id: normalizeId(`${item.name}-${cleanPrice(item.price)}`, `item-${category.id}-${index + 1}`),
      categoryId: category.id,
    }))
    .filter((item) => item.price && !isBadTitle(item.name));

  return items;
}

async function scrape() {
  const existing = await readExistingMenu();
  const existingCount = Array.isArray(existing?.items) ? existing.items.length : 0;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1800);

  const categories = await extractCategories(page);
  const allItems = [];

  for (const category of categories) {
    const url = category.url || SOURCE_URL;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1400);

    const items = await extractItemsFromPage(page, category);
    console.log(`${category.name}: ${items.length} items`);
    allItems.push(...items);
  }

  await browser.close();

  if (allItems.length === 0 && existingCount > 0) {
    console.log(`Scraper found 0 items. Keeping existing JSON with ${existingCount} items instead of overwriting it.`);
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify({ sourceUrl: SOURCE_URL, categories, items: allItems }, null, 2),
    "utf8",
  );

  console.log(`Saved ${categories.length} categories and ${allItems.length} items to ${OUTPUT_PATH}`);
}

scrape().catch((error) => {
  console.error(error);
  process.exit(1);
});
