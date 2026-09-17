"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import LoadingState from "@/components/common/LoadingState";
import { AnalyticsDashboardResponse } from "@/types/analytics";
import { formatINR, formatINRExact } from "@/lib/currency";

// One tooltip for both charts below, but only one of them plots money —
// `money` switches the value between rupees and a plain count so the deals/
// contacts bars don't render "₹12" for twelve deals.
function Tip({ active, payload, label, money = false }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}>
      <div style={{ color: "var(--text-muted)" }} className="mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey}>
          {p.name}: <span className="font-semibold">
            {money ? formatINRExact(p.value) : p.value.toLocaleString("en-IN")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"revenue" | "deals">("revenue");

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

  // The shell (sidebar and top bar) is the (app) layout's now, so the
  // loading and error states render only their own content.
  if (loading && !data) {
    return (
      <>
        <PageHeader title={<span className="font-medium text-foreground">Analytics</span>} />
        <LoadingState />
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <PageHeader title={<span className="font-medium text-foreground">Analytics</span>} />
        <div className="flex items-center justify-center py-24">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      </>
    );
  }

  if (!data) return null;
  const maxFunnel = Math.max(...data.salesFunnel.map((f) => f.count), 1);

  return (
    <>
        <PageHeader title={<span className="font-medium text-foreground">Analytics</span>} />

        <div className="space-y-6">
          {/* Date range filter */}
          <div className="flex items-center gap-3">
            <DatePicker value={from} onChange={setFrom} placeholder="From" className="w-40" />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
            <DatePicker value={to} onChange={setTo} placeholder="To" className="w-40" />
            <button onClick={fetchAnalytics}
              className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: "var(--text)", color: "var(--bg)" }}>
              Apply
            </button>
            {(from || to) && (
              <button onClick={() => { setFrom(""); setTo(""); fetchAnalytics(); }}
                className="px-3 py-2 rounded-lg text-xs" style={{ color: "var(--text-muted)" }}>
                Clear
              </button>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Avg Deal Size</div>
              <div className="text-2xl font-semibold mt-2" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                {formatINR(data.kpis.averageDealSize)}
              </div>
            </div>
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Win Rate</div>
              <div className="text-2xl font-semibold mt-2" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                {data.kpis.winRate}%
              </div>
            </div>
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sales Cycle</div>
              <div className="text-2xl font-semibold mt-2" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                {data.kpis.salesCycle} <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>days</span>
              </div>
            </div>
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Active Leads</div>
              <div className="text-2xl font-semibold mt-2" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                {data.kpis.activeLeads}
              </div>
            </div>
          </div>

          {/* Revenue trend + Growth */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>Revenue Trend</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Won deals by close month</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.revenueTrend}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatINR(v)} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={<Tip money />} />
                  <Line type="monotone" dataKey="amount" name="Revenue" stroke="var(--text)" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>Deals & Contacts Growth</h3>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Created per month</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.growth}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
                  <Bar dataKey="deals" name="Deals" fill="var(--text)" opacity={0.9} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="contacts" name="Contacts" fill="var(--text-muted)" opacity={0.6} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Funnel + Top Performers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text)" }}>Sales Funnel</h3>
              <div className="space-y-3">
                {data.salesFunnel.map((f) => (
                  <div key={f.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{f.stage}</span>
                      <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>{f.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(f.count / maxFunnel) * 100}%`, background: "var(--text)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Top Performers</h3>
                <Select
                  value={sort}
                  onChange={(v) => setSort(v as "revenue" | "deals")}
                  className="w-40"
                  options={[
                    { label: "By Revenue", value: "revenue" },
                    { label: "By Deals Closed", value: "deals" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                {data.topPerformers.length === 0 && (
                  <div className="text-xs py-4" style={{ color: "var(--text-muted)" }}>No closed deals yet</div>
                )}
                {data.topPerformers.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between py-2" style={{ borderBottom: i < data.topPerformers.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-4" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                      <span className="text-sm" style={{ color: "var(--text)" }}>{p.name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span style={{ color: "var(--text-muted)" }}>{p.closedDeals} deals</span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>{formatINR(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    </>
  );
}