"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Clock, Target, Trophy, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import DatePicker from "@/components/common/DatePicker";
import ErrorBanner from "@/components/common/ErrorBanner";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import MetricStrip from "@/components/common/MetricStrip";
import SectionCard from "@/components/common/SectionCard";
import SegmentedToggle from "@/components/common/SegmentedToggle";
import AreaTrendChart from "@/components/charts/AreaTrendChart";
import GroupedBarChart from "@/components/charts/GroupedBarChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsDashboardResponse, FunnelStage, TopPerformer } from "@/types/analytics";
import { formatINR, formatINRExact } from "@/lib/currency";

type Sort = "revenue" | "deals";

const METRIC_LABELS = ["Avg Deal Size", "Win Rate", "Sales Cycle", "Active Leads"];

const SORT_OPTIONS: { label: string; value: Sort }[] = [
  { label: "By Revenue", value: "revenue" },
  { label: "By Deals Closed", value: "deals" },
];

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<Sort>("revenue");

  const fetchAnalytics = useCallback(async () => {
    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({ sort });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/analytics/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError("Failed to load analytics. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [from, to, sort, router]);

  useEffect(() => { fetchAnalytics(); }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = <PageHeader title={<span className="font-medium text-foreground">Analytics</span>} />;

  // The shell (sidebar and top bar) is the (app) layout's now, so the
  // loading and error states render only their own content.
  if (loading && !data) {
    return (
      <>
        {header}
        <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
          <Skeleton className="h-9 w-80" />
          <MetricStrip loading metrics={METRIC_LABELS.map((label) => ({ label, value: null }))} />
          {[0, 1].map((row) => (
            <div key={row} className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((col) => (
                <Card key={col} className="space-y-5 p-5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-[220px] w-full" />
                </Card>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        {header}
        <ErrorBanner>{error}</ErrorBanner>
      </>
    );
  }

  if (!data) return null;

  return (
    <>
        {header}

        <div className="space-y-4" aria-busy={loading}>
          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker value={from} onChange={setFrom} placeholder="From" className="w-40" />
            <span className="text-xs text-muted-foreground">to</span>
            <DatePicker value={to} onChange={setTo} placeholder="To" className="w-40" />
            <Button onClick={fetchAnalytics}>
              <CalendarRange aria-hidden />
              Apply
            </Button>
            {(from || to) && (
              <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); fetchAnalytics(); }} className="text-muted-foreground">
                Clear
              </Button>
            )}
          </div>

          {/* KPIs */}
          <MetricStrip
            metrics={[
              { label: "Avg Deal Size", value: formatINR(data.kpis.averageDealSize), icon: Target },
              { label: "Win Rate", value: `${data.kpis.winRate}%`, icon: Trophy },
              {
                label: "Sales Cycle",
                value: (
                  <>
                    {data.kpis.salesCycle} <span className="text-sm font-normal text-muted-foreground">days</span>
                  </>
                ),
                icon: Clock,
              },
              { label: "Active Leads", value: data.kpis.activeLeads, icon: UserCheck },
            ]}
          />

          {/* Revenue trend + Growth */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Revenue Trend" description="Won deals by close month">
              <AreaTrendChart
                data={data.revenueTrend}
                xKey="month"
                yKey="amount"
                seriesLabel="Revenue"
                height={220}
                valueFormatter={formatINRExact}
                yTickFormatter={formatINR}
              />
            </SectionCard>

            <SectionCard title="Deals & Contacts Growth" description="Created per month">
              <GroupedBarChart
                data={data.growth}
                xKey="month"
                height={220}
                series={[
                  { key: "deals", label: "Deals" },
                  { key: "contacts", label: "Contacts" },
                ]}
                valueFormatter={(v) => v.toLocaleString("en-IN")}
              />
            </SectionCard>
          </div>

          {/* Funnel + Top Performers */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SalesFunnel stages={data.salesFunnel} />

            <SectionCard
              title="Top Performers"
              description={sort === "revenue" ? "Ranked by revenue won" : "Ranked by deals closed"}
              action={<SegmentedToggle label="Rank by" options={SORT_OPTIONS} value={sort} onChange={setSort} />}
            >
              <Leaderboard performers={data.topPerformers} sort={sort} />
            </SectionCard>
          </div>
        </div>
    </>
  );
}

// ─── Sales funnel ─────────────────────────────────────────────────────────────

/**
 * FLAG: the API gives the number of deals sitting in each stage now, plus a
 * "Leads" figure that counts contacts. Deals only move forward, so a deal in
 * Negotiation has already been through Qualification and Proposal; adding
 * each stage's count to every later stage's gives how many deals reached
 * each stage. That tapers the way a funnel should. A deal created straight
 * into a later stage is counted at the earlier ones too. "Leads" is not a
 * deal stage, so it is shown beside the funnel rather than as its top.
 */
function reachedCounts(stages: FunnelStage[]): FunnelStage[] {
  return stages.map((s, i) => ({
    stage: s.stage,
    count: stages.slice(i).reduce((sum, later) => sum + later.count, 0),
  }));
}

function SalesFunnel({ stages }: { stages: FunnelStage[] }) {
  const leads = stages.find((s) => s.stage === "Leads");
  const funnel = reachedCounts(stages.filter((s) => s.stage !== "Leads"));
  const top = funnel[0]?.count ?? 0;

  return (
    <SectionCard
      title="Sales Funnel"
      description="Deals that have reached each stage"
      action={
        leads && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Leads (contacts)</div>
            <div className="text-lg font-semibold tabular-nums leading-tight">{leads.count.toLocaleString()}</div>
          </div>
        )
      }
    >
      <ol className="space-y-2">
        {funnel.map((f, i) => {
          const width = top === 0 ? 0 : (f.count / top) * 100;
          const ofPrevious = i === 0 || funnel[i - 1].count === 0
            ? null
            : Math.round((f.count / funnel[i - 1].count) * 100);
          return (
            <li key={f.stage} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{f.stage}</span>
              <div className="flex h-8 min-w-0 flex-1 justify-center">
                {/* Bar width is the one dynamic value, so it stays inline. */}
                <div
                  className="flex h-full min-w-[2.5rem] items-center justify-center rounded-md bg-primary text-xs font-medium tabular-nums text-primary-foreground transition-[width]"
                  style={{ width: `${width}%`, opacity: 1 - i * 0.18 }}
                >
                  {f.count}
                </div>
              </div>
              <span className="w-14 shrink-0 text-right">
                {ofPrevious !== null && (
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
                    title="Share of the previous stage"
                  >
                    {ofPrevious}%
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-faint">
        Each deal counts at every stage up to where it is now. Percentages compare a stage with the one before it.
      </p>
    </SectionCard>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ performers, sort }: { performers: TopPerformer[]; sort: Sort }) {
  if (performers.length === 0) {
    return <div className="py-4 text-xs text-muted-foreground">No closed deals yet</div>;
  }

  // Bars are relative to the leader under the current ranking; there are no
  // targets or quotas to measure against.
  const valueOf = (p: TopPerformer) => (sort === "revenue" ? p.revenue : p.closedDeals);
  const best = Math.max(...performers.map(valueOf), 1);

  return (
    <ol className="divide-y">
      {performers.map((p, i) => (
        <li key={p.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
          <InitialsAvatar name={p.name} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-foreground">{p.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                <span className="text-muted-foreground">{p.closedDeals} deals</span>
                <span className="font-semibold tabular-nums text-foreground">{formatINR(p.revenue)}</span>
              </span>
            </div>
            <Progress value={(valueOf(p) / best) * 100} className="h-1" aria-label={`${p.name}: ${Math.round((valueOf(p) / best) * 100)}% of the leader`} />
          </div>
        </li>
      ))}
    </ol>
  );
}
