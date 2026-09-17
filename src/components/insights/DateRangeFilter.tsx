"use client";

import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import { DateRange, DateRangePreset } from "@/types/insights";

const PRESET_OPTIONS: { label: string; value: DateRangePreset }[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last7" },
  { label: "Last 30 days", value: "last30" },
  { label: "Last 90 days", value: "last90" },
  { label: "This month", value: "thisMonth" },
  { label: "Last month", value: "lastMonth" },
  { label: "This year", value: "thisYear" },
  { label: "Custom", value: "custom" },
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Turns a preset into concrete from/to dates. Presets are resolved HERE rather
 * than server-side so the API only ever deals in plain dates — adding a new
 * preset is then a UI-only change, and "today" always means the viewer's
 * today rather than the server's.
 *
 * `custom` passes the user's own picks straight through; an empty string on
 * either end means "unbounded", which the API treats as no filter on that side.
 */
export function resolveRange(preset: DateRangePreset, custom: DateRange): DateRange {
  if (preset === "custom") return custom;

  const today = new Date();

  switch (preset) {
    case "today":
      return { from: toISODate(today), to: toISODate(today) };

    case "yesterday": {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { from: toISODate(d), to: toISODate(d) };
    }

    case "last7":
    case "last30":
    case "last90": {
      const days = preset === "last7" ? 7 : preset === "last30" ? 30 : 90;
      const start = new Date(today);
      // Inclusive of today, so "last 7 days" spans 7 dates, not 8.
      start.setDate(start.getDate() - (days - 1));
      return { from: toISODate(start), to: toISODate(today) };
    }

    case "thisMonth":
      return {
        from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: toISODate(today),
      };

    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      // Day 0 of this month = last day of the previous month.
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toISODate(start), to: toISODate(end) };
    }

    case "thisYear":
      return {
        from: toISODate(new Date(today.getFullYear(), 0, 1)),
        to: toISODate(today),
      };

    default:
      return custom;
  }
}

interface DateRangeFilterProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  custom: DateRange;
  onCustomChange: (range: DateRange) => void;
}

export default function DateRangeFilter({
  preset,
  onPresetChange,
  custom,
  onCustomChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {preset === "custom" && (
        <>
          <DatePicker
            value={custom.from}
            onChange={(from) => onCustomChange({ ...custom, from })}
            placeholder="From"
            className="w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePicker
            value={custom.to}
            onChange={(to) => onCustomChange({ ...custom, to })}
            placeholder="To"
            className="w-36"
          />
        </>
      )}

      <Select
        value={preset}
        onChange={(v) => onPresetChange(v as DateRangePreset)}
        options={PRESET_OPTIONS}
        className="w-36"
        align="right"
      />
    </div>
  );
}
