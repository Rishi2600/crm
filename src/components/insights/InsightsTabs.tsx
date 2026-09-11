"use client";

import { InsightsTab } from "@/types/insights";

const TABS: { label: string; value: InsightsTab }[] = [
  { label: "Lead Insights", value: "lead" },
  { label: "Follow-Up Insights", value: "followup" },
  { label: "Deal Insights", value: "deal" },
];

interface InsightsTabsProps {
  value: InsightsTab;
  onChange: (tab: InsightsTab) => void;
}

/**
 * Full-width three-way switcher at the top of the Dashboard. Styled as the
 * same segmented control the Tasks page uses for its status filter, so the
 * app has one segmented-control look rather than two.
 */
export default function InsightsTabs({ value, onChange }: InsightsTabsProps) {
  return (
    <div
      className="grid grid-cols-3 gap-1 p-1 rounded-lg"
      style={{ background: "var(--bg-subtle)" }}
      role="tablist"
    >
      {TABS.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className="px-3 py-2 rounded-md text-xs font-medium transition-colors"
            style={{
              background: isActive ? "var(--bg-card)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-muted)",
              border: `1px solid ${isActive ? "var(--border)" : "transparent"}`,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
