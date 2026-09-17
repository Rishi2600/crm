"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InsightsTab } from "@/types/insights";

const TABS: { label: string; value: InsightsTab }[] = [
  { label: "Lead Insights", value: "lead" },
  { label: "Follow-Up Insights", value: "followup" },
  { label: "Deal Insights", value: "deal" },
];

interface InsightsTabsProps {
  value: InsightsTab;
  onChange: (tab: InsightsTab) => void;
  /** The content of whichever tab is selected. */
  children?: ReactNode;
}

/**
 * The three-way switch at the top of the Dashboard, on Radix Tabs (which adds
 * arrow-key navigation between tabs).
 *
 * FLAG: deliberately ONE panel whose value always equals the selected tab,
 * rather than a panel per tab. Lead and Follow-Up Insights share a single
 * InsightsPanel instance, and that is what keeps the user's date range when
 * they switch between the two. A panel per tab would unmount it on every
 * switch and reset the range.
 */
export default function InsightsTabs({ value, onChange, children }: InsightsTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as InsightsTab)} className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-3">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
}
