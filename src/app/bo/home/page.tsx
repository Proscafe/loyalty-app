import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { BOFrame } from "../BOFrame";

const modules = [
  ["/bo/cover", "COVER", "Selling price vs live calculated cost"],
  ["/bo/fnb", "F&B", "Purchase prices, suppliers and pack content"],
  ["/bo/prep", "PREP & SAUCES", "Sauces, preparations and nested recipes"],
  ["/bo/utilities", "UTL COST", "Gas, electricity, oil, wood and labor"],
  ["/bo/menu", "MENU COSTING", "Menu recipes and item costing"],
  ["/bo/reports", "REPORTS", "Food cost, profit, review queue and sales"],
  ["/bo/settings", "SETTINGS", "Exchange rate and BO configuration"],
] as const;

export default async function BOHomePage() {
  await requireRole(["master_admin"]);

  return (
    <BOFrame title="BO COSTING SYSTEM" subtitle="All costing modules are now connected to the BO database.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(([href, label, note]) => (
          <Link
            key={href}
            href={href}
            className="group rounded-[18px] border border-white/10 bg-white/[0.045] p-5 transition hover:border-[#ffd66b]/40 hover:bg-white/[0.07]"
          >
            <div className="text-[13px] font-black uppercase group-hover:text-[#ffd66b]">{label}</div>
            <div className="mt-2 text-[12px] font-semibold leading-5 text-white/45">{note}</div>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.08em] text-[#ffd66b]">OPEN →</div>
          </Link>
        ))}
      </div>
    </BOFrame>
  );
}
