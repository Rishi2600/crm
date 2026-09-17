"use client";

import { PipelineStage } from "@/types/dashboard";
import { formatINRExact } from "@/lib/currency";
import SectionCard from "@/components/common/SectionCard";
import { Progress } from "@/components/ui/progress";
import { DEAL_STAGE_COLOR, FALLBACK_STATUS_COLOR } from "@/components/common/statusColors";

export default function PipelineChart({ data }: { data: PipelineStage[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);

  return (
    <SectionCard title="Pipeline" description={`${total} open deals`} className="h-full">
      <div className="space-y-4">
        {data.map((item) => {
          const pct = total === 0 ? 0 : Math.round((item.count / total) * 100);
          return (
            <div key={item.stage} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: DEAL_STAGE_COLOR[item.stage] ?? FALLBACK_STATUS_COLOR }}
                    aria-hidden
                  />
                  <span className="truncate">{item.stage}</span>
                </span>
                <span className="font-medium tabular-nums text-foreground">{item.count}</span>
              </div>
              <Progress value={pct} className="h-1" aria-label={`${item.stage}: ${pct}% of open deals`} />
            </div>
          );
        })}
      </div>

      {totalAmount > 0 && (
        <div className="mt-5 border-t pt-4">
          <div className="text-xs text-muted-foreground">Total pipeline value</div>
          <div className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {formatINRExact(totalAmount)}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
