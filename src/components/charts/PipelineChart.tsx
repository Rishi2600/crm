"use client";

import { PipelineStage } from "@/types/dashboard";

export default function PipelineChart({ data }: { data: PipelineStage[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="p-5 rounded-xl h-full" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="mb-5">
        <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Pipeline</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{total} open deals</p>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const pct = total === 0 ? 0 : Math.round((item.count / total) * 100);
          return (
            <div key={item.stage}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.stage}</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text)" }}>
                  {item.count}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: "var(--text)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {totalAmount > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>Total pipeline value</div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
            ${totalAmount.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
