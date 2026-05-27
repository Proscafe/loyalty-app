"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

export function RewardCelebration({
  open,
  rewardLabel,
  onClose,
}: {
  open: boolean;
  rewardLabel: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    // Two bursts for a richer feel
    const fire = (particleRatio: number, opts: confetti.Options) =>
      confetti({
        origin: { y: 0.6 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
        colors: ["#ff7a11", "#ffc071", "#0e0e10", "#ffffff"],
      });
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2,  { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    const t = setTimeout(() => onClose(), 8000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -6, y: 30 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
            className="card p-8 mx-6 max-w-sm w-full text-center bg-gradient-to-br from-white via-brand-50 to-brand-100 border-brand-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">🎉</div>
            <div className="text-[11px] tracking-[0.2em] uppercase text-brand-700 font-bold mb-2">
              Reward earned
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight mb-3">
              You earned a {rewardLabel}!
            </h2>
            <p className="text-sm text-black/60 mb-6">
              Show this to the staff next time to redeem it.
            </p>
            <button onClick={onClose} className="btn-brand w-full">
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
