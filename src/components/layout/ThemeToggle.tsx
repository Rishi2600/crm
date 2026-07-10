"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

// Must match --bg values in globals.css for light/dark — the overlay circle
// uses these directly so the "flood" color matches the real theme exactly.
const BG_LIGHT = "#ffffff";
const BG_DARK = "#0a0a0a";

interface Overlay {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    if (!btnRef.current) return;

    const rect = btnRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Distance from the button to the farthest screen corner —
    // ensures the circle fully covers the viewport once expanded.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const next = !dark;

    // Overlay is painted in the color we're transitioning TO. As it expands
    // from the button outward it visually "floods" the new theme over the
    // old one. Once it fully covers the screen, we flip the real theme
    // underneath (invisible swap, colors already match) and drop the overlay.
    setOverlay({ x, y, radius, color: next ? BG_DARK : BG_LIGHT });

    window.setTimeout(() => {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("crm-theme", next ? "dark" : "light");
      setDark(next);
      setOverlay(null);
    }, 500);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        {dark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
      </button>

      {/* Portal-less fixed overlay — sits above everything during the transition */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            key="theme-reveal"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
            style={{
              position: "fixed",
              top: overlay.y - overlay.radius,
              left: overlay.x - overlay.radius,
              width: overlay.radius * 2,
              height: overlay.radius * 2,
              borderRadius: "9999px",
              background: overlay.color,
              pointerEvents: "none",
              zIndex: 9999,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}