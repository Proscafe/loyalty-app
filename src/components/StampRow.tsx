"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  name: string;
  count: number;     // 0..5
  total?: number;    // default 5
  highlight?: boolean;
}

export function StampRow({ name, count, total = 5, highlight }: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-base font-semibold">{name}</span>
        <span className="text-xs font-semibold text-black/50 tabular-nums">
          {count}/{total}
        </span>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < count;
          const isJustFilled = highlight && i === count - 1;
          return (
            <div key={i} className="relative flex-1 aspect-square max-w-[40px]">
              <AnimatePresence>
                <motion.div
                  key={filled ? "f" : "e"}
                  initial={isJustFilled ? { scale: 0, rotate: -30 } : false}
                  animate={
                    isJustFilled
                      ? { scale: [0, 1.25, 1], rotate: [0, -8, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                  className={`absolute inset-0 rounded-full border-2 ${
                    filled
                      ? "bg-brand-500 border-brand-500 shadow-[0_4px_16px_-4px_rgba(240,95,7,0.5)]"
                      : "bg-transparent border-dashed border-black/15"
                  }`}
                />
              </AnimatePresence>
              {isJustFilled && (
                <motion.div
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.2 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-brand-400"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
