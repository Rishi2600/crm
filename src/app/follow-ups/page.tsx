"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import LoadingState from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
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

const STATUS_COLOR: Record<string, string> = {
  Planned: "var(--text-muted)",
  Pending: "#d97706",
  Done: "var(--green)",
  Missed: "var(--red)",
  Cancelled: "var(--text-faint)",
};

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

  // Debounced search — 🚩 same fix as Contacts/Deals/Tasks: skip the
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
      .then((json) => {
        if (json) setContactOptions(json.data.map((c: any) => ({ id: c.id, name: c.name })));
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

  const hasFilters = !!(search || agent || from || to || filter !== "all");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Follow-up {total > 0 && <span style={{ color: "var(--text-muted)" }}>· {total}</span>}
          </span>
          <ThemeToggle />
        </div>

        <div className="p-8 space-y-5">
          {/* Summary tiles */}
          <div className="grid grid-cols-7 gap-3">
            {SUMMARY_TILES.map((tile) => (
              <div
                key={tile.key}
                className="p-4 rounded-xl text-center"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{tile.label}</div>
                <div className="text-2xl font-semibold mt-2 tabular-nums" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                  {summary[tile.key].toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-64">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                  className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by lead name..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                />
              </div>

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
                <button onClick={clearFilters} className="px-3 py-2 rounded-lg text-xs" style={{ color: "var(--text-muted)" }}>
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
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
              <button
                onClick={() => setShowForm(true)}
                className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                + New Follow-Up
              </button>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {PILLS.map((pill) => {
              const isActive = filter === pill.value;
              return (
                <button
                  key={pill.value}
                  onClick={() => { setFilter(pill.value); setPage(1); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? "var(--text)" : "var(--bg-subtle)",
                    color: isActive ? "var(--bg)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {pill.label}{pill.key ? ` (${summary[pill.key]})` : ""}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{
              background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)",
            }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium" style={{
              background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)",
            }}>
              <div className="col-span-3">Lead</div>
              <div className="col-span-2">Agent</div>
              <div className="col-span-2">Scheduled</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Mark as</div>
              <div className="col-span-1 text-center">Move</div>
            </div>

            {loading && <LoadingState variant="inline" />}

            {!loading && !error && followUps.length === 0 && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No Follow-up
              </div>
            )}

            {!loading && !error && followUps.map((f, i) => (
              <div
                key={f.id}
                className="grid grid-cols-12 px-4 py-3 text-sm items-center"
                style={{ borderBottom: i < followUps.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="col-span-3">
                  <div style={{ color: "var(--text)" }}>{f.contactName}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {f.company ?? "—"}{f.dealTitle ? ` · ${f.dealTitle}` : ""}
                  </div>
                  {f.notes && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>{f.notes}</div>
                  )}
                </div>

                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>{f.agentName}</div>

                <div className="col-span-2 text-xs" style={{ color: f.isOverdue ? "var(--red)" : "var(--text-muted)" }}>
                  {formatWhen(f.scheduledAt)}
                  {f.rescheduleCount > 0 && (
                    <div style={{ color: "var(--text-faint)" }}>
                      moved {f.rescheduleCount}×
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[f.status] }} />
                    <span style={{ color: "var(--text)" }}>{f.status}</span>
                  </span>
                  {f.outcome && (
                    <div className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{f.outcome}</div>
                  )}
                </div>

                <div className="col-span-2">
                  {/* Outcome is offered only once a follow-up is Done — on
                      anything else the API rejects it, so showing it would be
                      an option that can only fail. */}
                  {f.status === "Done" ? (
                    <Select
                      value={f.outcome ?? ""}
                      onChange={(v) => patchFollowUp(f.id, { outcome: v }, "Outcome saved")}
                      placeholder="Set outcome"
                      options={FOLLOW_UP_OUTCOMES.map((o) => ({ label: o, value: o }))}
                    />
                  ) : (
                    <Select
                      value=""
                      onChange={(v) => patchFollowUp(f.id, { status: v }, `Follow-up marked ${v}`)}
                      placeholder="Mark as"
                      options={[
                        { label: "Done", value: "Done" },
                        { label: "Missed", value: "Missed" },
                        { label: "Cancelled", value: "Cancelled" },
                      ]}
                    />
                  )}
                </div>

                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => {
                      setRescheduling(f);
                      setNewDate("");
                      setNewTime("09:00");
                      setRescheduleError("");
                    }}
                    aria-label="Reschedule follow-up"
                    style={{ color: "var(--text-faint)" }}
                  >
                    <CalendarClock size={15} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Page {page} of {totalPages} · Count: {total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "var(--bg-subtle)", border: "1px solid var(--border)",
                    color: "var(--text)", opacity: page === 1 ? 0.4 : 1,
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "var(--bg-subtle)", border: "1px solid var(--border)",
                    color: "var(--text)", opacity: page === totalPages ? 0.4 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* New Follow-Up dialog */}
        <Dialog
          open={showForm}
          onClose={() => setShowForm(false)}
          title="New Follow-Up"
          description="Schedule a follow-up on a lead."
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? "Scheduling..." : "Schedule"}
              </button>
            </>
          }
        >
          {formError && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
              {formError}
            </div>
          )}
          <div className="space-y-3">
            <Select
              value={contactId}
              onChange={setContactId}
              placeholder="Select lead"
              options={contactOptions.map((c) => ({ label: c.name, value: c.id }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <DatePicker value={scheduledDate} onChange={setScheduledDate} placeholder="Follow-up date" />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
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
              <button onClick={() => setRescheduling(null)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                Reschedule
              </button>
            </>
          }
        >
          {rescheduleError && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
              {rescheduleError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker value={newDate} onChange={setNewDate} placeholder="New date" />
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
            />
          </div>
        </Dialog>
      </main>
    </div>
  );
}
