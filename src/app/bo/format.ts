/** BO presentation only: never round data used for calculations, input values or database writes. */
export type BOCurrencyRounding = { lbp: number; usd: number };
export const DEFAULT_BO_ROUNDING: BOCurrencyRounding = { lbp: 1, usd: 0.01 };
const LBP_STEPS = [1, 100, 500, 1000, 5000, 10000];
const USD_STEPS = [0.01, 0.05, 0.1, 0.5, 1];

function currencyRounding(): BOCurrencyRounding {
  if (typeof window === "undefined") return DEFAULT_BO_ROUNDING;
  try {
    const saved = JSON.parse(window.localStorage.getItem("pros_bo_currency_rounding") || "{}");
    const lbp = Number(saved?.lbp);
    const usd = Number(saved?.usd);
    return {
      lbp: LBP_STEPS.includes(lbp) ? lbp : 1,
      usd: USD_STEPS.includes(usd) ? usd : 0.01,
    };
  } catch { return DEFAULT_BO_ROUNDING; }
}
function rounded(value: number, step: number): number {
  return Math.round(value / step) * step;
}
export function moneyLbp(value: unknown) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const { lbp } = currencyRounding();
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded(n, lbp));
}
export function moneyUsd(value: unknown) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const { usd } = currencyRounding();
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rounded(n, usd));
}
export function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
