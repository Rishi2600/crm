"use client";

import type { LucideIcon } from "lucide-react";

interface InsightCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  loading?: boolean;
}

/**
 * One KPI tile in the Lead / Follow-Up Insights grid.
 *
 * Deliberately monochrome rather than the per-card pastel palette of the
 * reference screenshot — every other surface in this app (MetricCard, both
 * dashboard charts, the analytics page) draws in var(--text) / var(--text-muted),
 * and a nine-colour palette here would be the only place that isn't. The icon
 * carries the distinction between cards instead of hue, which also keeps the
 * grid legible in dark mode without a second set of colours.
 */
export default function InsightCard({ title, value, icon: Icon, loading = false }: InsightCardProps) {
  return (
    <div
      className="p-4 rounded-xl flex flex-col items-center gap-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <span className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        {title}
      </span>

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      >
        <Icon size={18} strokeWidth={1.6} style={{ color: "var(--text-muted)" }} />
      </div>

      <div
        className="w-full py-2 rounded-lg text-center text-lg font-semibold tabular-nums"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          color: loading ? "var(--text-faint)" : "var(--text)",
          letterSpacing: "-0.02em",
        }}
      >
        {loading ? "—" : value.toLocaleString()}
      </div>
    </div>
  );
}
