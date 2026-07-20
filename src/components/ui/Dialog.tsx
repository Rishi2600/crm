"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string; // e.g. "480px" — defaults below
}

export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "480px",
}: DialogProps) {
  // Portals need `document`, which doesn't exist during SSR — only render
  // once mounted client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll while open — otherwise the page scrolls behind the
  // dialog, which feels broken on longer pages (e.g. Contacts, Tasks lists).
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full rounded-2xl overflow-hidden"
            style={{
              maxWidth,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>{title}</h2>
                {description && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                className="flex items-center justify-end gap-2 px-5 py-4"
                style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)" }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}