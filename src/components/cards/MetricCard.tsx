interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
}

export default function MetricCard({ title, value, subtitle, trend }: MetricCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div
      className="p-5 rounded-xl flex flex-col gap-3"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {title}
      </span>

      <div className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
        {value}
      </div>

      {(trend !== undefined || subtitle) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span
              className="text-xs font-medium"
              style={{ color: isPositive ? "var(--green)" : "var(--red)" }}
            >
              {isPositive ? "↑" : "↓"} {Math.abs(trend)}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
