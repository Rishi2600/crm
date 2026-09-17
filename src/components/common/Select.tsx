"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  align = "left",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => setMounted(true), []);

  // Recompute the trigger's on-screen position — used both when opening
  // and continuously while open, since the dropdown is portaled to
  // document.body (fixed positioning) rather than living inside whatever
  // scrollable container the trigger sits in (e.g. a Dialog's body). This
  // is what makes it immune to being clipped by an ancestor's
  // `overflow: auto/hidden` — the classic reason a dropdown "disappears"
  // inside a modal.
  const updateRect = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setRect({ top: r.bottom + 6, left: align === "right" ? r.right : r.left, width: r.width });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    // Keep position correct if the page/dialog scrolls or the window
    // resizes while the dropdown is open.
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  // Outside-click must check BOTH the trigger and the portaled panel,
  // since the panel is no longer a DOM descendant of the trigger's wrapper
  // once it's rendered via createPortal.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background: "var(--bg-subtle)",
          border: `1px solid ${open ? "var(--text-muted)" : "var(--border)"}`,
          color: selected ? "var(--text)" : "var(--text-muted)",
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg
          width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {mounted && open && rect && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[100] py-1 rounded-lg overflow-auto"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            top: rect.top,
            left: align === "right" ? undefined : rect.left,
            right: align === "right" ? window.innerWidth - rect.left : undefined,
            minWidth: rect.width,
            maxHeight: "260px",
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  color: "var(--text)",
                  background: isSelected ? "var(--bg-subtle)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-subtle)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}