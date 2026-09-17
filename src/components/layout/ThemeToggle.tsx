"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

// FLAG: must match --background in src/app/globals.css (light 0 0% 98%,
// dark 0 0% 3.1%). The overlay circle is painted in these colours, so if
// they drift from the real theme the switch flashes a wrong colour before
// settling.
const BG_LIGHT = "#fafafa";
const BG_DARK = "#080808";

interface Overlay {
  x: number;
  y: number;
  radius: number;
  color: string;
}

/**
 * The theme switch, as a hook, so both the standalone button (login and
 * landing pages) and the sidebar's user menu share one implementation.
 *
 * `toggle(origin)` expands the reveal circle from `origin` — whatever was
 * clicked. `overlay` must be rendered by a component that stays mounted for
 * the half-second animation, which is why the user menu renders it outside
 * its dropdown (the dropdown closes on click).
 */
export function useThemeToggle(): {
  dark: boolean;
  toggle: (origin: Element | null) => void;
  overlay: ReactNode;
} {
  const [dark, setDark] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback((origin: Element | null) => {
    // Read the live class rather than state, so two toggles on screen can
    // never disagree about which way to switch.
    const next = !document.documentElement.classList.contains("dark");

    const rect = origin?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    // Distance from the origin to the farthest screen corner —
    // ensures the circle fully covers the viewport once expanded.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Overlay is painted in the color we're transitioning TO. As it expands
    // from the origin outward it visually "floods" the new theme over the
    // old one. Once it fully covers the screen, we flip the real theme
    // underneath (invisible swap, colors already match) and drop the overlay.
    setOverlay({ x, y, radius, color: next ? BG_DARK : BG_LIGHT });

    window.setTimeout(() => {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("crm-theme", next ? "dark" : "light");
      setDark(next);
      setOverlay(null);
    }, 500);
  }, []);

  const overlayNode = (
    // Portal-less fixed overlay — sits above everything during the transition.
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
  );

  return { dark, toggle, overlay: overlayNode };
}

export default function ThemeToggle() {
  const { dark, toggle, overlay } = useThemeToggle();
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => toggle(btnRef.current)}
        aria-label="Toggle theme"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:opacity-70"
      >
        {dark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
      </button>
      {overlay}
    </>
  );
}
