"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { GraphPoint } from "@/types/dashboard";

function formatY(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg text-xs"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}>
      <div style={{ color: "var(--text-muted)" }} className="mb-0.5">{label}</div>
      <div className="font-semibold">${payload[0].value.toLocaleString()}</div>
    </div>
  );
}

export default function RevenueChart({ data }: { data: GraphPoint[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="mb-5">
        <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Revenue</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Won deals · last 6 months</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatY} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--text)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "var(--text)", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
