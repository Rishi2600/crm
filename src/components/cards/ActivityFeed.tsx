import { ActivityItem } from "@/types/dashboard";

const TYPE_LABEL: Record<string, string> = {
  DEAL_CREATED:      "Deal created",
  DEAL_UPDATED:      "Deal updated",
  MEETING_SCHEDULED: "Meeting scheduled",
  CONTACT_UPDATED:   "Contact updated",
  EMAIL_SENT:        "Email sent",
  TASK_COMPLETED:    "Task completed",
  NOTE_ADDED:        "Note added",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="mb-5">
        <h3 className="text-sm font-medium" style={{ color: "var(--text)" }}>Activity</h3>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Latest actions</p>
      </div>

      <div className="space-y-4">
        {activities.map((a) => (
          <div key={a.id} className="flex gap-3">
            {/* Dot */}
            <div className="mt-1.5 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
                {a.message}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{a.user.name}</span>
                <span style={{ color: "var(--text-faint)" }}>·</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{timeAgo(a.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
        )}
      </div>
    </div>
  );
}
