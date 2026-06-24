import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://shark-accounting.com/menu/Pros_cafe_dekwaneh/index.php?category_id=1562";
const OUTPUT_PATH = path.join(process.cwd(), "src/app/menu.dekwaneh/pros-menu-dekwaneh.json");
const BASE_URL = new URL(SOURCE_URL).origin;

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

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

    const links = Array.from(document.querySelectorAll("a[href*='category_id']"));
    return links
      .map((link, index) => {
        const href = link.getAttribute("href") || "";
        const url = abs(href);
        const text = (link.textContent || "").trim().replace(/\s+/g, " ");
        const image = link.querySelector("img")?.getAttribute("src") || "";
        const categoryId = new URL(url).searchParams.get("category_id") || `category-${index + 1}`;
        return { sourceId: categoryId, name: text, image: abs(image), url };
      })
      .filter((category) => category.name && category.url);
  });

  const categories = uniqueBy(raw, (category) => category.sourceId || category.name.toLowerCase())
    .filter((category) => category.name.length <= 45)
    .map((category, index) => ({
      ...category,
      id: normalizeId(category.name || category.sourceId, `category-${index + 1}`),
      name: category.name || `Category ${index + 1}`,
    }));

  if (categories.length > 0) return categories;

  return [
    { id: "menu", sourceId: "1562", name: "MENU", image: "", url: SOURCE_URL },
  ];
}

async function extractItemsFromPage(page, categoryId) {
  const rawItems = await page.evaluate(() => {
    const abs = (value) => {
      try {
        return value ? new URL(value, window.location.href).href : "";
      } catch {
        return value || "";
      }
    };

    const priceRegex = /(?:\d[\d,.\s]*)\s*(?:L\.?\s*L\.?|LL|LBP|ل\.?\s*ل\.?)\b/i;
    const blockedTags = new Set(["HTML", "BODY", "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"]);

    const elementsWithPrice = Array.from(document.querySelectorAll("body *"))
      .filter((element) => !blockedTags.has(element.tagName))
      .filter((element) => priceRegex.test((element.textContent || "").replace(/\s+/g, " ")));

    const cards = [];
    const seen = new Set();

    for (const priceElement of elementsWithPrice) {
      let current = priceElement;
      let best = priceElement;

      for (let depth = 0; depth < 7 && current; depth += 1) {
        const text = (current.textContent || "").trim().replace(/\s+/g, " ");
        const hasUsefulClass = /item|product|menu|card|meal|dish|food/i.test(current.className || "");
        const hasImage = Boolean(current.querySelector("img"));
        const hasTitle = Boolean(current.querySelector("h1,h2,h3,h4,h5,strong,b,[class*='title'],[class*='name']"));

        if (text.length > 8 && text.length <= 900 && (hasUsefulClass || hasImage || hasTitle || depth >= 2)) {
          best = current;
          if (hasUsefulClass || hasImage || hasTitle) break;
        }

        current = current.parentElement;
      }

      const key = `${best.tagName}-${best.className}-${(best.textContent || "").trim().slice(0, 140)}`;
      if (!seen.has(key)) {
        seen.add(key);
        cards.push(best);
      }
    }

    return cards
      .map((card, index) => {
        const rawText = (card.textContent || "").trim();
        const compactText = rawText.replace(/\s+/g, " ");
        const price = compactText.match(priceRegex)?.[0]?.replace(/\s+/g, " ").trim() || "";
        const image = card.querySelector("img")?.getAttribute("src") || "";

        const titleElement = card.querySelector("h1,h2,h3,h4,h5,strong,b,[class*='title'],[class*='name']");
        const lines = rawText
          .split(/\n+/)
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .filter((line) => !priceRegex.test(line));

        let title = (titleElement?.textContent || "").trim().replace(/\s+/g, " ");
        if (!title || priceRegex.test(title) || title.length > 90) {
          title = lines.find((line) => line.length >= 2 && line.length <= 90) || compactText.replace(price, "").trim().slice(0, 90);
        }

        const description = lines
          .filter((line) => line !== title)
          .join(" ")
          .replace(title, "")
          .replace(price, "")
          .trim()
          .slice(0, 220);

        if (!title || !price) return null;

        return {
          id: `item-${index + 1}`,
          name: title,
          arabicName: "",
          description,
          price,
          image: abs(image),
        };
      })
      .filter(Boolean);
  });

  return uniqueBy(rawItems, (item) => `${item.name.toLowerCase()}-${item.price.toLowerCase()}`)
    .map((item, index) => ({
      ...item,
      id: normalizeId(`${item.name}-${item.price}`, `item-${categoryId}-${index + 1}`),
      categoryId,
    }));
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  const categories = await extractCategories(page);
  const allItems = [];

  for (const category of categories) {
    const url = category.url || `${BASE_URL}/menu/Pros_cafe_dekwaneh/index.php?category_id=${category.sourceId}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);

    const items = await extractItemsFromPage(page, category.id);
    console.log(`${category.name}: ${items.length} items`);
    allItems.push(...items);
  }

  await browser.close();

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
