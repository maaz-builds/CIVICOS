"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trash2, AlertTriangle, Trees, Droplets } from "lucide-react";

interface StartupSplashProps {
  onComplete?: () => void;
}

export default function StartupSplash({ onComplete }: StartupSplashProps) {
  const reduceMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);

      if (onComplete) {
        setTimeout(onComplete, 800);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const civicIcons = [
    { id: "pothole", Icon: AlertTriangle, color: "text-[#FF671F]" },
    { id: "garbage", Icon: Trash2, color: "text-[#046A38]" },
    { id: "tree", Icon: Trees, color: "text-amber-700" },
    { id: "waste", Icon: Droplets, color: "text-blue-500" },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-navy-950"
        >
          {/* Animated Tricolor Ribbon */}
          <motion.div
            animate={{ x: "-50%" }}
            transition={{
              duration: reduceMotion ? 0 : 8,
              repeat: reduceMotion ? 0 : Infinity,
              ease: "linear",
            }}
            className="absolute left-0 top-1/4 h-[400px] w-[200vw] opacity-90"
          >
            <svg
              viewBox="0 0 2000 400"
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              <g strokeLinecap="round" strokeLinejoin="round">
                <path
                  d="M0 200 Q250 320 500 200 T1000 200 T1500 200 T2000 200"
                  fill="none"
                  stroke="#046A38"
                  strokeWidth="44"
                />
                <path
                  d="M0 160 Q250 280 500 160 T1000 160 T1500 160 T2000 160"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="44"
                  filter="drop-shadow(0px 8px 8px rgba(0,0,0,0.12))"
                />
                <path
                  d="M0 120 Q250 240 500 120 T1000 120 T1500 120 T2000 120"
                  fill="none"
                  stroke="#FF671F"
                  strokeWidth="44"
                  filter="drop-shadow(0px 8px 8px rgba(0,0,0,0.15))"
                />
              </g>
            </svg>
          </motion.div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.3, duration: reduceMotion ? 0 : 0.8 }}
              className="mb-12 text-center"
            >
              <h1 className="font-display text-6xl font-bold tracking-tight text-white drop-shadow md:text-7xl">
                CivicFix
              </h1>
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.22em] text-slate-400">
                Hyderabad AI Civic Platform
              </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-5">
              {civicIcons.map((item, i) => {
                const Icon = item.Icon;

                return (
                  <motion.div
                    key={item.id}
                    initial={
                      reduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.5 + i * 0.15,
                      duration: reduceMotion ? 0 : 0.5,
                    }}
                    className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-md md:h-28 md:w-28"
                  >
                    <Icon
                      className={`h-10 w-10 md:h-12 md:w-12 ${item.color}`}
                      strokeWidth={1.5}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}