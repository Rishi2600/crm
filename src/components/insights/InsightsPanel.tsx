"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Clock,
  Globe,
  ListChecks,
  PhoneMissed,
  RefreshCw,
  Repeat,
  RotateCcw,
  Share2,
  ThumbsDown,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import InsightCard from "@/components/insights/InsightCard";
import DateRangeFilter, { resolveRange } from "@/components/insights/DateRangeFilter";
import TrendsChart from "@/components/charts/TrendsChart";
import {
  DateRange,
  DateRangePreset,
  FollowUpInsightKpis,
  InsightsSummaryResponse,
  LeadInsightKpis,
  TrendGranularity,
  TrendMetric,
  TrendPoint,
  TrendsResponse,
} from "@/types/insights";

// ─── Card definitions ─────────────────────────────────────────────────────────
// Keyed by the KPI field name so a card can never drift away from the number
// it displays — adding a KPI to the API type surfaces here as a type error
// rather than a silently missing tile.

const LEAD_CARDS: { key: keyof LeadInsightKpis; title: string; icon: LucideIcon }[] = [
  { key: "totalLeads", title: "Total Leads", icon: Globe },
  { key: "freshLeads", title: "Fresh Leads", icon: UserPlus },
  { key: "closedLeads", title: "Closed Leads", icon: CircleSlash },
  { key: "referredLeads", title: "Referred Leads", icon: Share2 },
  { key: "revivedLeads", title: "Revived Leads", icon: RefreshCw },
  { key: "reEnquiredLeads", title: "Re-Enquired Leads", icon: Repeat },
  { key: "convertedLeads", title: "Converted Leads", icon: UserCheck },
  { key: "irrelevantLeads", title: "Irrelevant Leads", icon: ThumbsDown },
  { key: "interestedLeads", title: "Interested Leads", icon: Users },
];

const FOLLOW_UP_CARDS: { key: keyof FollowUpInsightKpis; title: string; icon: LucideIcon }[] = [
  { key: "totalFollowUps", title: "Total Follow-Ups", icon: ListChecks },
  { key: "pending", title: "Pending", icon: Clock },
  { key: "completed", title: "Completed", icon: CheckCircle2 },
  { key: "overdue", title: "Overdue", icon: AlertTriangle },
  { key: "dueToday", title: "Due Today", icon: CalendarClock },
  { key: "rescheduled", title: "Rescheduled", icon: RotateCcw },
  { key: "missed", title: "Missed", icon: PhoneMissed },
  { key: "converted", title: "Converted", icon: TrendingUp },
];

interface InsightsPanelProps {
  tab: "lead" | "followup";
}

export default function InsightsPanel({ tab }: InsightsPanelProps) {
  const router = useRouter();

  // ── Date range — shared by the KPI cards and the trend graph ─────────────
  const [preset, setPreset] = useState<DateRangePreset>("last30");
  const [custom, setCustom] = useState<DateRange>({ from: "", to: "" });

  // Recomputed only when the inputs actually change — resolveRange returns a
  // fresh object every call, which would otherwise re-fire both fetch effects
  // on every render.
  const range = useMemo(() => resolveRange(preset, custom), [preset, custom]);

  // ── KPI cards ────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<LeadInsightKpis | FollowUpInsightKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState("");

  // ── Trend graph — the metric is independent of the tab on purpose, so you
  // can plot follow-ups while reading lead cards. It does follow the tab when
  // you switch, as a sensible starting point. ──────────────────────────────
  const [metric, setMetric] = useState<TrendMetric>(tab === "followup" ? "followUps" : "leads");
  const [granularity, setGranularity] = useState<TrendGranularity>("daily");
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState("");

  // 🚩 Synced DURING render rather than in an effect. React discards this
  // intermediate render and re-runs immediately with the new metric, so the
  // fetch effects below fire exactly once per tab switch. Doing it in a
  // useEffect instead would render once with the stale metric first, firing a
  // throwaway /trends request for the wrong series every time the tab changes
  // — the same duplicate-request pattern Contacts and Deals already had to be
  // fixed for. Keeping the range in state (rather than remounting the panel
  // on tab change) is what preserves the user's date filter across tabs.
  const [syncedTab, setSyncedTab] = useState(tab);
  if (syncedTab !== tab) {
    setSyncedTab(tab);
    setMetric(tab === "followup" ? "followUps" : "leads");
  }

  const fetchKpis = useCallback(async () => {
    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    setKpisLoading(true);
    setKpisError("");

    const params = new URLSearchParams({ tab });
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    try {
      const res = await fetch(`/api/insights/summary?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: InsightsSummaryResponse = await res.json();
      setKpis(json.kpis);
    } catch {
      setKpisError("Failed to load insights. Please refresh.");
      setKpis(null);
    } finally {
      setKpisLoading(false);
    }
  }, [tab, range, router]);

  const fetchTrends = useCallback(async () => {
    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    setTrendLoading(true);
    setTrendError("");

    const params = new URLSearchParams({ metric, granularity });
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);

    try {
      const res = await fetch(`/api/insights/trends?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }

      const json = await res.json();
      if (!res.ok) {
        // The API rejects ranges too wide for the chosen granularity with a
        // specific message — surface it rather than a generic failure, since
        // it tells the user exactly which control to change.
        setTrendError(json.message ?? "Failed to load trends.");
        setPoints([]);
        return;
      }

      setPoints((json as TrendsResponse).points);
    } catch {
      setTrendError("Failed to load trends. Please refresh.");
      setPoints([]);
    } finally {
      setTrendLoading(false);
    }
  }, [metric, granularity, range, router]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const cards =
    tab === "lead"
      ? LEAD_CARDS.map((c) => ({ ...c, value: (kpis as LeadInsightKpis | null)?.[c.key] ?? 0 }))
      : FOLLOW_UP_CARDS.map((c) => ({ ...c, value: (kpis as FollowUpInsightKpis | null)?.[c.key] ?? 0 }));

  return (
    <div className="space-y-6">
      {/* Performance overview — KPI cards */}
      <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Performance Overview</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {tab === "lead" ? "Lead Insights" : "Follow-Up Insights"}
            </p>
          </div>

          <DateRangeFilter
            preset={preset}
            onPresetChange={setPreset}
            custom={custom}
            onCustomChange={setCustom}
          />
        </div>

        {kpisError && (
          <div className="mb-4 px-3 py-2.5 rounded-lg text-xs" style={{
            background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)",
          }}>
            {kpisError}
          </div>
        )}

        <div className={`grid gap-3 ${tab === "lead" ? "grid-cols-5" : "grid-cols-4"}`}>
          {cards.map((card) => (
            <InsightCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              loading={kpisLoading}
            />
          ))}
        </div>
      </div>

      {/* Trends graph */}
      <TrendsChart
        points={points}
        metric={metric}
        onMetricChange={setMetric}
        granularity={granularity}
        onGranularityChange={setGranularity}
        loading={trendLoading}
        error={trendError}
      />
    </div>
  );
}
