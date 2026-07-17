"use client";

import { useEffect, useRef, useState } from "react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_LABELS = ["S","M","T","W","T","F","S"];

function toDateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DatePicker({ value, onChange, placeholder = "Select date", className = "" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + "T00:00:00") : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateOnly(new Date());

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function selectDay(day: number) {
    const picked = new Date(year, month, day);
    onChange(formatISO(picked));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{
          background: "var(--bg-subtle)",
          border: `1px solid ${open ? "var(--text-muted)" : "var(--border)"}`,
          color: selectedDate ? "var(--text)" : "var(--text-muted)",
        }}
      >
        <span className="truncate">{selectedDate ? formatDisplay(selectedDate) : placeholder}</span>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"
          style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 p-3 rounded-xl"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            width: "260px",
          }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="p-1 rounded-md"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="p-1 rounded-md"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} className="text-center text-xs" style={{ color: "var(--text-faint)" }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const cellDate = toDateOnly(new Date(year, month, day));
              const isSelected = selectedDate && toDateOnly(selectedDate).getTime() === cellDate.getTime();
              const isToday = cellDate.getTime() === today.getTime();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  className="w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs transition-colors"
                  style={{
                    background: isSelected ? "var(--text)" : "transparent",
                    color: isSelected ? "var(--bg)" : "var(--text)",
                    border: isToday && !isSelected ? "1px solid var(--text-muted)" : "1px solid transparent",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="w-full mt-2 pt-2 text-xs text-center"
              style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}