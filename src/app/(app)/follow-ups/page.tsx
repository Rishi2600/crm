"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, CheckCircle2, ClipboardCheck, PhoneMissed, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FilterPills from "@/components/common/FilterPills";
import FollowUpFields from "@/components/common/FollowUpFields";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import MetricStrip from "@/components/common/MetricStrip";
import PaginationFooter from "@/components/common/PaginationFooter";
import RevealOnHover, { RevealLine } from "@/components/common/RevealOnHover";
import RowActionsMenu from "@/components/common/RowActionsMenu";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { TableMessageRow, TableSkeletonRows } from "@/components/common/TableStates";
import { FOLLOW_UP_STATUS_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FollowUpsApiResponse,
  FollowUpResponse,
  FollowUpSummary,
  FollowUpFilter,
  FOLLOW_UP_OUTCOMES,
  AgentOption,
} from "@/types/followups";

interface ContactOption { id: string; name: string; }

const EMPTY_SUMMARY: FollowUpSummary = {
  total: 0, planned: 0, pending: 0, done: 0, missed: 0, cancelled: 0, rescheduled: 0,
};

// The count tiles across the top, in the reference's order.
const SUMMARY_TILES: { label: string; key: keyof FollowUpSummary }[] = [
  { label: "Total", key: "total" },
  { label: "Planned", key: "planned" },
  { label: "Pending", key: "pending" },
  { label: "Rescheduled", key: "rescheduled" },
  { label: "Cancelled", key: "cancelled" },
  { label: "Done", key: "done" },
  { label: "Missed", key: "missed" },
];

const PILLS: { label: string; value: FollowUpFilter; key: keyof FollowUpSummary | null }[] = [
  { label: "ALL", value: "all", key: "total" },
  { label: "PENDING", value: "pending", key: "pending" },
  { label: "MISSED", value: "missed", key: "missed" },
  { label: "PLANNED", value: "planned", key: "planned" },
  { label: "DONE", value: "done", key: "done" },
  { label: "CANCELLED", value: "cancelled", key: "cancelled" },
  { label: "RESCHEDULED", value: "rescheduled", key: "rescheduled" },
];

// What "Mark as" offers on a row that isn't Done yet.
const MARK_AS: { value: string; icon: typeof Ban }[] = [
  { value: "Done", icon: CheckCircle2 },
  { value: "Missed", icon: PhoneMissed },
  { value: "Cancelled", icon: Ban },
];

const TABLE_COLUMNS = 5;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function FollowUpsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [followUps, setFollowUps] = useState<FollowUpResponse[]>([]);
  const [summary, setSummary] = useState<FollowUpSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FollowUpFilter>("all");
  const [agent, setAgent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("scheduledAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Option lists for the filter + create form
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);

  // Create dialog
  const [showForm, setShowForm] = useState(false);
  const [contactId, setContactId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reschedule dialog
  const [rescheduling, setRescheduling] = useState<FollowUpResponse | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [rescheduleError, setRescheduleError] = useState("");

  const token = () => localStorage.getItem("crm-token");

  const fetchFollowUps = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      filter, sort, page: String(page), limit: "20",
    });
    if (search.trim()) params.set("search", search.trim());
    if (agent) params.set("agent", agent);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/follow-ups?${params.toString()}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: FollowUpsApiResponse = await res.json();
      setFollowUps(json.data);
      setSummary(json.summary);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError("Failed to load follow-ups. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [filter, sort, page, search, agent, from, to, router]);

  // Covers the initial load as well as every non-search filter change.
  useEffect(() => { fetchFollowUps(); }, [filter, sort, page, agent, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search — FLAG: same fix as Contacts/Deals/Tasks: skip the
  // mount-time run, since the effect above already fetches on first load.
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    const t = setTimeout(() => { setPage(1); fetchFollowUps(); }, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Option lists — fetched once; failures are non-fatal (the dropdowns just
  // come back empty rather than taking the page down with them).
  useEffect(() => {
    const t = token();
    if (!t) return;
    const auth = { headers: { Authorization: `Bearer ${t}` } };

    fetch("/api/users/assignable", auth)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setAgents(json.data); })
      .catch(() => {});

    fetch("/api/contacts?limit=100", auth)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data: ContactOption[] } | null) => {
        if (json) setContactOptions(json.data.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  function clearFilters() {
    setSearch("");
    setFilter("all");
    setAgent("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function handleCreate() {
    setFormError("");
    if (!contactId) { setFormError("Lead is mandatory"); return; }
    if (!scheduledDate) { setFormError("Follow-up date is mandatory"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          contactId,
          scheduledDate,
          scheduledTime: scheduledTime || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.message ?? "Failed to schedule follow-up");
        return;
      }

      setContactId(""); setScheduledDate(""); setScheduledTime("09:00"); setNotes("");
      setShowForm(false);
      showToast("Follow-up scheduled successfully");
      fetchFollowUps();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchFollowUp(id: string, body: object, successMessage: string) {
    // Optimistic list refresh happens after the server agrees — these rows
    // carry derived status and summary counts, so a local guess would put the
    // pill totals out of step with the table until the next load.
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.message ?? "Failed to update follow-up", "error");
        return false;
      }
      showToast(successMessage);
      fetchFollowUps();
      return true;
    } catch {
      showToast("Network error. Please try again.", "error");
      return false;
    }
  }

  async function handleReschedule() {
    setRescheduleError("");
    if (!rescheduling) return;
    if (!newDate) { setRescheduleError("Pick a new date"); return; }

    const ok = await patchFollowUp(
      rescheduling.id,
      { scheduledDate: newDate, scheduledTime: newTime || undefined },
      "Follow-up rescheduled"
    );
    if (ok) {
      setRescheduling(null);
      setNewDate("");
      setNewTime("09:00");
    }
  }

  function openReschedule(f: FollowUpResponse) {
    setRescheduling(f);
    setNewDate("");
    setNewTime("09:00");
    setRescheduleError("");
  }

  const hasFilters = !!(search || agent || from || to || filter !== "all");

  return (
    <>
        <PageHeader
          title={
            <span className="font-medium text-foreground">
              Follow-up {total > 0 && <span className="text-muted-foreground">· {total}</span>}
            </span>
          }
        >
          <Button size="sm" onClick={() => setShowForm(true)} aria-label="New Follow-Up">
            <Plus aria-hidden />
            <span className="hidden sm:inline">New Follow-Up</span>
          </Button>
        </PageHeader>

        <div className="space-y-4">
          {/* Summary strip — skeletons only until the first answer arrives;
              later reloads keep the last numbers on screen. */}
          <MetricStrip
            perRow={7}
            loading={loading && summary === EMPTY_SUMMARY}
            metrics={SUMMARY_TILES.map((tile) => ({
              label: tile.label,
              value: summary[tile.key].toLocaleString(),
            }))}
          />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by lead name..."
              className="w-full sm:w-64"
            />

            <Select
              value={agent}
              onChange={(v) => { setAgent(v); setPage(1); }}
              placeholder="Agent"
              className="w-40"
              options={[{ label: "All agents", value: "" }, ...agents.map((a) => ({ label: a.name, value: a.id }))]}
            />

            <DatePicker value={from} onChange={(v) => { setFrom(v); setPage(1); }} placeholder="From" className="w-36" />
            <DatePicker value={to} onChange={(v) => { setTo(v); setPage(1); }} placeholder="To" className="w-36" />

            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                Clear
              </Button>
            )}
          </div>

          {/* Status pills, with the sort on the right */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterPills
              label="Filter by status"
              value={filter}
              onChange={(v) => { setFilter(v as FollowUpFilter); setPage(1); }}
              options={PILLS.map((pill) => ({
                label: pill.label,
                value: pill.value,
                count: pill.key ? summary[pill.key] : undefined,
              }))}
            />
            <Select
              value={sort}
              onChange={setSort}
              className="w-44"
              align="right"
              options={[
                { label: "Latest first", value: "scheduledAt" },
                { label: "Soonest first", value: "scheduledAtAsc" },
                { label: "Recently created", value: "createdAt" },
              ]}
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-4 text-xs">Lead</TableHead>
                  <TableHead className="px-4 text-xs">Agent</TableHead>
                  <TableHead className="px-4 text-xs">Scheduled</TableHead>
                  <TableHead className="px-4 text-xs">Status</TableHead>
                  <TableHead className="px-4 text-right text-xs">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows columns={TABLE_COLUMNS} />}

                {!loading && !error && followUps.length === 0 && (
                  <TableMessageRow colSpan={TABLE_COLUMNS}>No Follow-up</TableMessageRow>
                )}

                {!loading && !error && followUps.map((f) => (
                  <TableRow key={f.id} className="group/row">
                    <TableCell className="max-w-[300px] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <InitialsAvatar name={f.contactName} />
                        <div className="min-w-0 flex-1 pt-1">
                          <RevealOnHover primary={<span className="font-medium">{f.contactName}</span>}>
                            <RevealLine>
                              {f.company ?? "—"}{f.dealTitle ? ` · ${f.dealTitle}` : ""}
                            </RevealLine>
                            {f.notes && <RevealLine tone="faint">{f.notes}</RevealLine>}
                          </RevealOnHover>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {f.agentName}
                    </TableCell>

                    <TableCell className={cn("px-4 py-3 text-xs", f.isOverdue ? "text-danger" : "text-muted-foreground")}>
                      {formatWhen(f.scheduledAt)}
                      {f.rescheduleCount > 0 && (
                        <div className="text-faint">
                          moved {f.rescheduleCount}×
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <StatusBadge color={FOLLOW_UP_STATUS_COLOR[f.status]}>{f.status}</StatusBadge>
                      {f.outcome && (
                        <div className="mt-1 text-xs text-muted-foreground">{f.outcome}</div>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-right">
                      <RowActionsMenu label={`Actions for the follow-up with ${f.contactName}`}>
                        {/* Outcome is offered only once a follow-up is Done — on
                            anything else the API rejects it, so showing it would be
                            an option that can only fail. */}
                        {f.status === "Done" ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <ClipboardCheck aria-hidden />
                              Set outcome
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                              <DropdownMenuRadioGroup
                                value={f.outcome ?? ""}
                                onValueChange={(v) => {
                                  // A radio item reports every pick; saving only a
                                  // real change matches the select it replaced.
                                  if (v !== f.outcome) patchFollowUp(f.id, { outcome: v }, "Outcome saved");
                                }}
                              >
                                {FOLLOW_UP_OUTCOMES.map((o) => (
                                  <DropdownMenuRadioItem key={o} value={o}>{o}</DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : (
                          <>
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Mark as</DropdownMenuLabel>
                            {MARK_AS.map(({ value, icon: Icon }) => (
                              <DropdownMenuItem
                                key={value}
                                onSelect={() => patchFollowUp(f.id, { status: value }, `Follow-up marked ${value}`)}
                              >
                                <Icon aria-hidden />
                                {value}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => openReschedule(f)}>
                          <CalendarClock aria-hidden />
                          Reschedule
                        </DropdownMenuItem>
                      </RowActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {!loading && !error && total > 0 && (
              <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            )}
          </div>
        </div>

        {/* New Follow-Up dialog */}
        <Dialog
          open={showForm}
          onClose={() => setShowForm(false)}
          title="New Follow-Up"
          description="Schedule a follow-up on a lead."
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Scheduling..." : "Schedule"}
              </Button>
            </>
          }
        >
          {formError && <ErrorBanner className="mb-4">{formError}</ErrorBanner>}
          <div className="space-y-4">
            <FormField label="Lead" htmlFor="new-follow-up-lead">
              <Select
                id="new-follow-up-lead"
                value={contactId}
                onChange={setContactId}
                placeholder="Select lead"
                options={contactOptions.map((c) => ({ label: c.name, value: c.id }))}
              />
            </FormField>
            <FollowUpFields
              idPrefix="new-follow-up"
              date={scheduledDate}
              onDateChange={setScheduledDate}
              time={scheduledTime}
              onTimeChange={setScheduledTime}
              notes={notes}
              onNotesChange={setNotes}
            />
          </div>
        </Dialog>

        {/* Reschedule dialog */}
        <Dialog
          open={!!rescheduling}
          onClose={() => setRescheduling(null)}
          title="Reschedule follow-up"
          description={rescheduling ? `Move the follow-up with ${rescheduling.contactName} to a new date.` : ""}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRescheduling(null)}>
                Cancel
              </Button>
              <Button onClick={handleReschedule}>
                Reschedule
              </Button>
            </>
          }
        >
          {rescheduleError && <ErrorBanner className="mb-4">{rescheduleError}</ErrorBanner>}
          <FollowUpFields
            idPrefix="reschedule"
            date={newDate}
            onDateChange={setNewDate}
            time={newTime}
            onTimeChange={setNewTime}
            dateLabel="New date"
            datePlaceholder="New date"
          />
        </Dialog>
    </>
  );
}
