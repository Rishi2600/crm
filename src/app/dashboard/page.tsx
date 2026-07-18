"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardResponse } from "@/types/dashboard";
import MetricCard from "@/components/cards/MetricCard";
import RevenueChart from "@/components/charts/RevenueChart";
import PipelineChart from "@/components/charts/PipelineChart";
import ActivityFeed from "@/components/cards/ActivityFeed";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LoadingState from "@/components/ui/LoadingState";

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("crm-token");
    const user  = localStorage.getItem("crm-user");
    if (!token) { router.push("/login"); return; }
    if (user) { try { setUserName(JSON.parse(user).name); } catch {} }

    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) { router.push("/login"); return; }
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setError("Failed to load. Please refresh."))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <LoadingState label="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <span className="text-sm" style={{ color: "var(--red)" }}>{error}</span>
      </div>
    );
  }

  if (!data) return null;

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
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between px-8"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""}
            </span>
            <span className="text-sm ml-2" style={{ color: "var(--text-muted)" }}>{dateStr}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--live)" }} />
              Live
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(data.revenue.amount)}
              trend={data.revenue.growth}
              subtitle="vs last month"
            />
            <MetricCard
              title="Active Deals"
              value={data.activeDeals}
              subtitle="in pipeline"
            />
            <MetricCard
              title="Contacts"
              value={data.contacts.toLocaleString()}
              subtitle="total"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${data.conversionRate}%`}
              subtitle="deals won"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <RevenueChart data={data.revenueGraph} />
            </div>
            <PipelineChart data={data.pipeline} />
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-3 gap-4">
            <ActivityFeed activities={data.activities} />

            {/* Deals by month */}
            <div className="col-span-2 p-5 rounded-xl"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="mb-5">
                <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Deals</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Created · last 6 months</p>
              </div>

              <div className="flex items-end gap-2 h-28">
                {data.dealsGraph.map((point) => {
                  const max = Math.max(...data.dealsGraph.map((p) => p.value), 1);
                  const pct = Math.max((point.value / max) * 100, 4);
                  return (
                    <div key={point.month} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {point.value}
                      </span>
                      <div className="w-full rounded-sm" style={{
                        height: `${pct}%`,
                        background: "var(--text)",
                        opacity: 0.15 + (pct / 100) * 0.85,
                      }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{point.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}