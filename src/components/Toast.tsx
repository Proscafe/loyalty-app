"use client";

import { motion, AnimatePresence } from "framer-motion";

export function Toast({ message, tone = "success" }: { message: string | null; tone?: "success" | "error" }) {
  const bg = tone === "success" ? "bg-ink-900" : "bg-red-600";
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${bg} text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg max-w-[90vw]`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
