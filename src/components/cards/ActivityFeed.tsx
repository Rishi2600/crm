import { ActivityItem } from "@/types/dashboard";
import SectionCard from "@/components/common/SectionCard";

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
    <SectionCard title="Activity" description="Latest actions" className="h-full">
      <ul className="space-y-4">
        {activities.map((a) => (
          <li key={a.id} className="flex gap-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />

            <div className="min-w-0 flex-1">
              <p className="text-xs leading-relaxed text-foreground">{a.message}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{a.user.name}</span>
                <span className="text-faint" aria-hidden>·</span>
                <span className="shrink-0">{timeAgo(a.createdAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {activities.length === 0 && (
        <p className="py-4 text-xs text-muted-foreground">No activity yet.</p>
      )}
    </SectionCard>
  );
}
