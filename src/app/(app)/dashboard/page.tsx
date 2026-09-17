"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DashboardResponse } from "@/types/dashboard";
import { InsightsTab } from "@/types/insights";
import RevenueChart from "@/components/charts/RevenueChart";
import PipelineChart from "@/components/charts/PipelineChart";
import DealsChart from "@/components/charts/DealsChart";
import ActivityFeed from "@/components/cards/ActivityFeed";
import { formatINR } from "@/lib/currency";
import { PageHeader } from "@/components/layout/PageHeader";
import InsightsTabs from "@/components/insights/InsightsTabs";
import InsightsPanel from "@/components/insights/InsightsPanel";
import MetricStrip, { type Metric } from "@/components/common/MetricStrip";
import ErrorBanner from "@/components/common/ErrorBanner";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const DEAL_METRIC_LABELS = ["Total Revenue", "Active Deals", "Contacts", "Conversion Rate"];

function dealMetrics(data: DashboardResponse): Metric[] {
  return [
    {
      label: "Total Revenue",
      value: formatINR(data.revenue.amount),
      change: { percent: data.revenue.growth, caption: "vs last month" },
    },
    { label: "Active Deals", value: data.activeDeals },
    { label: "Contacts", value: data.contacts.toLocaleString() },
    { label: "Conversion Rate", value: `${data.conversionRate}%` },
  ];
}

// The Deal Insights layout: a 4-cell strip, then two rows of one wide and one
// narrow card. Loading and loaded states share it so nothing jumps.
function DealInsightsLayout({ strip, revenue, pipeline, activity, deals }: {
  strip: ReactNode;
  revenue: ReactNode;
  pipeline: ReactNode;
  activity: ReactNode;
  deals: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {strip}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">{revenue}</div>
        {pipeline}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {activity}
        <div className="min-w-0 lg:col-span-2">{deals}</div>
      </div>
    </div>
  );
}

function CardSkeleton({ bodyClassName }: { bodyClassName: string }) {
  return (
    <Card className="h-full space-y-5 p-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className={bodyClassName} />
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<InsightsTab>("lead");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  // Auth guard + greeting. Split out from the data fetch below because the
  // Lead/Follow-Up tabs need the guard too but not /api/dashboard.
  useEffect(() => {
    const token = localStorage.getItem("crm-token");
    const user  = localStorage.getItem("crm-user");
    if (!token) { router.push("/login"); return; }
    if (user) { try { setUserName(JSON.parse(user).name); } catch {} }
  }, [router]);

  // /api/dashboard is fetched LAZILY — only once the Deal Insights tab is
  // actually opened. The dashboard now lands on Lead Insights, so fetching it
  // on mount would spend a multi-query request on a tab the user may never
  // look at. The ref (rather than checking `loading`/`data`) keeps the effect
  // from re-firing on its own state updates.
  const dealFetchStarted = useRef(false);

  useEffect(() => {
    if (tab !== "deal" || dealFetchStarted.current) return;

    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    dealFetchStarted.current = true;
    setLoading(true);

    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => {
        setError("Failed to load. Please refresh.");
        // Allow a retry on the next tab switch rather than latching the error.
        dealFetchStarted.current = false;
      })
      .finally(() => setLoading(false));
  }, [tab, router]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <>
        <PageHeader
          title={
            <>
              <span className="truncate font-medium text-foreground">
                {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}
              </span>
              <span className="hidden truncate text-muted-foreground sm:inline">{dateStr}</span>
            </>
          }
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-live" aria-hidden />
            Live
          </div>
        </PageHeader>

        {/* Content */}
        <div>
          <InsightsTabs value={tab} onChange={setTab}>
          {/* Lead / Follow-Up Insights — KPI cards + trend graph */}
          {tab !== "deal" && <InsightsPanel tab={tab} />}

          {/* Deal Insights — the original dashboard's content */}
          {tab === "deal" && (
            <>
              {loading && (
                <DealInsightsLayout
                  strip={
                    <MetricStrip
                      loading
                      metrics={DEAL_METRIC_LABELS.map((label) => ({ label, value: null }))}
                    />
                  }
                  revenue={<CardSkeleton bodyClassName="h-[220px] w-full" />}
                  pipeline={<CardSkeleton bodyClassName="h-40 w-full" />}
                  activity={<CardSkeleton bodyClassName="h-48 w-full" />}
                  deals={<CardSkeleton bodyClassName="h-[220px] w-full" />}
                />
              )}

              {!loading && error && <ErrorBanner>{error}</ErrorBanner>}

              {!loading && !error && data && (
                <DealInsightsLayout
                  strip={<MetricStrip metrics={dealMetrics(data)} />}
                  revenue={<RevenueChart data={data.revenueGraph} />}
                  pipeline={<PipelineChart data={data.pipeline} />}
                  activity={<ActivityFeed activities={data.activities} />}
                  deals={<DealsChart data={data.dealsGraph} />}
                />
              )}
            </>
          )}
          </InsightsTabs>
        </div>
    </>
  );
}
