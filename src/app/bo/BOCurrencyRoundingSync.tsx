"use client";
import { useEffect } from "react";

/** Cache server-side display preferences across BO pages. Raw financial data stays untouched. */
export function BOCurrencyRoundingSync() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/bo/settings", { cache: "no-store" });
        if (!r.ok) return;
        const body = await r.json();
        if (cancelled) return;
        const lbp = Number(body?.settings?.lbp_rounding ?? 1);
        const usd = Number(body?.settings?.usd_rounding ?? 0.01);
        const next = JSON.stringify({ lbp: [1,100,500,1000,5000,10000].includes(lbp) ? lbp : 1, usd: [0.01,0.05,0.1,0.5,1].includes(usd) ? usd : 0.01 });
        const key = "pros_bo_currency_rounding";
        if (localStorage.getItem(key) !== next) {
          localStorage.setItem(key, next);
          // Formatters read localStorage on render; refresh once when preferences change.
          if (sessionStorage.getItem("pros_bo_rounding_reloaded") !== next) {
            sessionStorage.setItem("pros_bo_rounding_reloaded", next);
            window.location.reload();
          }
        }
      } catch { /* Settings may be temporarily unavailable; use last-known preferences. */ }
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
