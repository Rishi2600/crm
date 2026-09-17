"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Gauge,
  History,
  MessageSquarePlus,
  Pencil,
  Radio,
  Repeat,
  Route as RouteIcon,
  Timer,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import Dialog from "@/components/common/Dialog";
import LoadingState from "@/components/common/LoadingState";
import { useToast } from "@/components/common/Toast";
import { SUB_STATUS_BY_STATUS } from "@/lib/leads";
import {
  LeadDetail,
  LeadDetailResponse,
  LeadStatusLabel,
  LeadSubStatusLabel,
  LeadHistoryEntry,
} from "@/types/leads";
import { AgentOption } from "@/types/followups";

const ALL_STATUSES = Object.keys(SUB_STATUS_BY_STATUS) as LeadStatusLabel[];
const SOURCES = ["Direct", "Referral", "Website", "Campaign", "Event", "Other"];
const TEMPERATURES = ["Hot", "Warm", "Cold"];

const STATUS_COLOR: Record<string, string> = {
  Fresh: "#2563eb",
  Interested: "#d97706",
  Converted: "var(--green)",
  Closed: "var(--red)",
  Irrelevant: "var(--text-faint)",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agents, setAgents] = useState<AgentOption[]>([]);

  // Status change — the lead recording prompt, identical in behaviour to the
  // one on the list page because it calls the same endpoint, which refuses
  // the change without a remark.
  const [showStatus, setShowStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatusLabel>("Fresh");
  const [newSubStatus, setNewSubStatus] = useState<LeadSubStatusLabel>("Untouched");
  const [remark, setRemark] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  // Edit details
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({
    firstName: "", lastName: "", email: "", phone: "", companyName: "",
    location: "", sourceName: "", leadScore: "",
  });
  const [editTemperature, setEditTemperature] = useState("Warm");
  const [editSource, setEditSource] = useState("Direct");
  const [editAgent, setEditAgent] = useState("");
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Standalone remark
  const [showRemark, setShowRemark] = useState(false);
  const [newRemark, setNewRemark] = useState("");
  const [remarkError, setRemarkError] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);

  // Follow-up
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("09:00");
  const [fuNotes, setFuNotes] = useState("");
  const [fuError, setFuError] = useState("");
  const [fuSaving, setFuSaving] = useState(false);

  // History drawer — the full timeline, and the assignment-only slice behind
  // the Assignment Trail button.
  const [historyView, setHistoryView] = useState<"all" | "assignments" | null>(null);

  const token = () => localStorage.getItem("crm-token");

  const fetchLead = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${params.id}`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { setError("This lead no longer exists."); return; }
      if (res.status === 403) { setError("You do not have access to this lead."); return; }
      if (!res.ok) throw new Error("Failed");

      const json: LeadDetailResponse = await res.json();
      setLead(json.data);
    } catch {
      setError("Failed to load this lead. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  useEffect(() => {
    const t = token();
    if (!t) return;
    fetch("/api/users/assignable", { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setAgents(json.data); })
      .catch(() => {});
  }, []);

  // ── Status ────────────────────────────────────────────────────────────────
  function openStatus() {
    if (!lead) return;
    setNewStatus(lead.status);
    setNewSubStatus(lead.subStatus);
    setRemark("");
    setStatusError("");
    setShowStatus(true);
  }

  function pickStatus(value: string) {
    const s = value as LeadStatusLabel;
    setNewStatus(s);
    setNewSubStatus(SUB_STATUS_BY_STATUS[s][0]);
  }

  async function saveStatus() {
    setStatusError("");
    if (!remark.trim()) { setStatusError("A remark is required when a lead's status changes"); return; }

    setStatusSaving(true);
    try {
      const res = await fetch(`/api/leads/${params.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: newStatus, subStatus: newSubStatus, remark: remark.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setStatusError(json.message ?? "Failed to update status"); return; }

      setShowStatus(false);
      showToast(json.message ?? "Status updated");
      fetchLead();
    } catch {
      setStatusError("Network error. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit() {
    if (!lead) return;
    const [firstName, ...rest] = lead.name.split(" ");
    setEdit({
      firstName,
      lastName: rest.join(" "),
      email: lead.email,
      phone: lead.phone ?? "",
      companyName: lead.company ?? "",
      location: lead.location ?? "",
      sourceName: lead.sourceName ?? "",
      leadScore: String(lead.leadScore),
    });
    setEditTemperature(lead.temperature);
    setEditSource(lead.source);
    setEditAgent(lead.agentId);
    setEditError("");
    setShowEdit(true);
  }

  async function saveEdit() {
    setEditError("");
    if (!edit.firstName.trim()) { setEditError("First name cannot be empty"); return; }
    if (!edit.lastName.trim()) { setEditError("Last name cannot be empty"); return; }
    if (!edit.email.trim()) { setEditError("Email cannot be empty"); return; }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/leads/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          ...edit,
          leadScore: edit.leadScore === "" ? undefined : Number(edit.leadScore),
          temperature: editTemperature,
          source: editSource,
          ownerId: editAgent || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setEditError(json.message ?? "Failed to save"); return; }

      setShowEdit(false);
      showToast("Lead updated successfully");
      fetchLead();
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Remark ────────────────────────────────────────────────────────────────
  async function saveRemark() {
    setRemarkError("");
    if (!newRemark.trim()) { setRemarkError("Remark cannot be empty"); return; }

    setRemarkSaving(true);
    try {
      const res = await fetch(`/api/leads/${params.id}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ remark: newRemark.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setRemarkError(json.message ?? "Failed to add remark"); return; }

      setShowRemark(false);
      setNewRemark("");
      showToast("Remark added");
      fetchLead();
    } catch {
      setRemarkError("Network error. Please try again.");
    } finally {
      setRemarkSaving(false);
    }
  }

  // ── Follow-up ─────────────────────────────────────────────────────────────
  async function scheduleFollowUp() {
    setFuError("");
    if (!fuDate) { setFuError("Follow-up date is mandatory"); return; }

    setFuSaving(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          contactId: params.id,
          scheduledDate: fuDate,
          scheduledTime: fuTime || undefined,
          notes: fuNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFuError(json.message ?? "Failed to schedule follow-up"); return; }

      setShowFollowUp(false);
      setFuDate(""); setFuTime("09:00"); setFuNotes("");
      showToast("Follow-up scheduled successfully");
      fetchLead();
    } catch {
      setFuError("Network error. Please try again.");
    } finally {
      setFuSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // The shell (sidebar and top bar) is the (app) layout's now, so the
  // loading and error states render only their own content. The back button
  // sits in the top bar in every state, including while loading.
  const backToLeads = (
    <PageHeader
      title={
        <button
          type="button"
          onClick={() => router.push("/leads")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden /> Leads
        </button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {backToLeads}
        <LoadingState label="Loading lead..." />
      </>
    );
  }

  if (error || !lead) {
    return (
      <>
        {backToLeads}
        <div>
          <button onClick={() => router.push("/leads")} className="text-xs flex items-center gap-1.5 mb-4" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={14} /> Back to Leads
          </button>
          <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)" }}>
            {error || "Lead not found"}
          </div>
        </div>
      </>
    );
  }

  const historyEntries = historyView === "assignments" ? lead.assignmentTrail : lead.history;

  return (
    <>
        {backToLeads}

        <div className="space-y-5">
          {/* Header */}
          <div className="p-5 rounded-xl flex items-start justify-between gap-4 flex-wrap" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <div className="text-base font-semibold" style={{ color: "var(--text)" }}>{lead.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Lead Id: {lead.id}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Created {formatWhen(lead.createdAt)}
                </div>
              </div>

              <button onClick={openStatus} className="text-left" title="Change status">
                <span
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[lead.status] }} />
                  <span style={{ color: "var(--text)" }}>{lead.status}</span>
                </span>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{lead.subStatus}</div>
              </button>

              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Agent
                <div style={{ color: "var(--text)" }}>{lead.agentName}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <HeaderButton icon={RouteIcon} label="Assignment Trail" onClick={() => setHistoryView("assignments")} />
              <HeaderButton icon={History} label="History" onClick={() => setHistoryView("all")} />
              <HeaderButton icon={MessageSquarePlus} label="Add Remark" onClick={() => { setNewRemark(""); setRemarkError(""); setShowRemark(true); }} />
              <HeaderButton icon={CalendarClock} label="Follow-up" onClick={() => { setFuError(""); setShowFollowUp(true); }} />
              <HeaderButton icon={Pencil} label="Edit" onClick={openEdit} primary />
            </div>
          </div>

          {/* Metric strip */}
          <div className="grid grid-cols-6 gap-3">
            <DetailCard title="Lead Age" value={`${lead.leadAge} Days`} icon={Timer} />
            <DetailCard title="Temperature" value={lead.temperature} icon={Gauge} />
            <DetailCard title="Source Name" value={lead.sourceName ?? lead.source} icon={Radio} />
            <DetailCard title="Re-Enquired" value={String(lead.reEnquiryCount)} icon={Repeat} />
            <DetailCard title="Last Follow-up" value={lead.lastFollowUpAt ? formatWhen(lead.lastFollowUpAt) : "No Follow-up"} icon={CalendarClock} />
            <DetailCard title="Lead Score" value={String(lead.leadScore)} icon={Gauge} />
          </div>

          {/* Personal details */}
          <Section title="Personal Details" action={<button onClick={openEdit} style={{ color: "var(--text-muted)" }}><Pencil size={14} strokeWidth={1.8} /></button>}>
            <div className="grid grid-cols-4 gap-y-4 gap-x-6">
              <Field label="Name" value={lead.name} />
              <Field label="Email" value={lead.email} />
              <Field label="Phone Number" value={lead.phone} />
              <Field label="Company" value={lead.company} />
              <Field label="Location" value={lead.location} />
              <Field label="Source" value={lead.source} />
              <Field label="Source Name" value={lead.sourceName} />
              <Field label="Lead Score" value={String(lead.leadScore)} />
              <Field label="Status" value={lead.status} />
              <Field label="Sub-Status" value={lead.subStatus} />
              <Field label="Lead Age" value={`${lead.leadAge} Days`} />
              <Field label="Next Follow-up" value={lead.nextFollowUpAt ? formatWhen(lead.nextFollowUpAt) : "Not Scheduled"} />
            </div>
          </Section>

          {/* Last remark */}
          <Section
            title="Last Lead Remark"
            action={
              <button onClick={() => setHistoryView("all")} style={{ color: "var(--text-muted)" }} title="View full history">
                <History size={14} strokeWidth={1.8} />
              </button>
            }
          >
            {lead.lastRemark ? (
              <div>
                <div className="text-sm" style={{ color: "var(--text)" }}>{lead.lastRemark.remark}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {lead.lastRemark.userName} · {formatWhen(lead.lastRemark.createdAt)} · {lead.lastRemark.type}
                </div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>No Remarks</div>
            )}
          </Section>

          {/* Timeline — the most recent entries inline, the rest behind the
              History button, so the page opens on what matters without
              becoming a wall of audit rows. */}
          <Section title="Recent Activity">
            {lead.history.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing recorded yet</div>
            ) : (
              <>
                <Timeline entries={lead.history.slice(0, 5)} />
                {lead.history.length > 5 && (
                  <button onClick={() => setHistoryView("all")} className="text-xs mt-3 underline" style={{ color: "var(--text-muted)" }}>
                    View all {lead.history.length} entries
                  </button>
                )}
              </>
            )}
          </Section>
        </div>

        {/* ── History drawer ───────────────────────────────────────────────── */}
        <Dialog
          open={historyView !== null}
          onClose={() => setHistoryView(null)}
          title={historyView === "assignments" ? "Assignment Trail" : "Lead History"}
          description={
            historyView === "assignments"
              ? "Every time this lead changed hands."
              : "Everything that has ever happened to this lead, newest first."
          }
          maxWidth="560px"
          footer={
            <button onClick={() => setHistoryView(null)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Close
            </button>
          }
        >
          {historyEntries.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Nothing recorded yet</div>
          ) : (
            <div className="max-h-96 overflow-y-auto pr-1">
              <Timeline entries={historyEntries} />
            </div>
          )}
        </Dialog>

        {/* ── Status change ────────────────────────────────────────────────── */}
        <Dialog
          open={showStatus}
          onClose={() => setShowStatus(false)}
          title="Change lead status"
          description={`Move ${lead.name} to a new status. A remark is required.`}
          footer={
            <>
              <button onClick={() => setShowStatus(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={saveStatus}
                disabled={statusSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: statusSaving ? 0.5 : 1 }}
              >
                {statusSaving ? "Saving..." : "Save & Record"}
              </button>
            </>
          }
        >
          {statusError && <DialogError message={statusError} />}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select value={newStatus} onChange={pickStatus} options={ALL_STATUSES.map((s) => ({ label: s, value: s }))} />
              <Select
                value={newSubStatus}
                onChange={(v) => setNewSubStatus(v as LeadSubStatusLabel)}
                options={SUB_STATUS_BY_STATUS[newStatus].map((s) => ({ label: s, value: s }))}
              />
            </div>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Record what happened — why is this lead moving? *"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
            />
          </div>
        </Dialog>

        {/* ── Edit details ─────────────────────────────────────────────────── */}
        <Dialog
          open={showEdit}
          onClose={() => setShowEdit(false)}
          title="Edit lead"
          description="Update this lead's details. Status changes go through the status prompt."
          maxWidth="560px"
          footer={
            <>
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: editSaving ? 0.5 : 1 }}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </>
          }
        >
          {editError && <DialogError message={editError} />}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextInput placeholder="First name *" value={edit.firstName} onChange={(v) => setEdit({ ...edit, firstName: v })} />
              <TextInput placeholder="Last name *" value={edit.lastName} onChange={(v) => setEdit({ ...edit, lastName: v })} />
            </div>
            <TextInput placeholder="Email *" value={edit.email} onChange={(v) => setEdit({ ...edit, email: v })} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput placeholder="Phone" value={edit.phone} onChange={(v) => setEdit({ ...edit, phone: v })} />
              <TextInput placeholder="Company" value={edit.companyName} onChange={(v) => setEdit({ ...edit, companyName: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={editSource} onChange={setEditSource} options={SOURCES.map((s) => ({ label: s, value: s }))} />
              <TextInput placeholder="Source name" value={edit.sourceName} onChange={(v) => setEdit({ ...edit, sourceName: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Select value={editTemperature} onChange={setEditTemperature} options={TEMPERATURES.map((s) => ({ label: s, value: s }))} />
              <TextInput placeholder="Location" value={edit.location} onChange={(v) => setEdit({ ...edit, location: v })} />
              <TextInput placeholder="Score 0–100" value={edit.leadScore} onChange={(v) => setEdit({ ...edit, leadScore: v.replace(/[^0-9]/g, "") })} />
            </div>
            <div>
              <div className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Assigned agent</div>
              <Select
                value={editAgent}
                onChange={setEditAgent}
                options={agents.map((a) => ({ label: a.name, value: a.id }))}
              />
            </div>
          </div>
        </Dialog>

        {/* ── Add remark ───────────────────────────────────────────────────── */}
        <Dialog
          open={showRemark}
          onClose={() => setShowRemark(false)}
          title="Add remark"
          description="Leave a note on this lead's history."
          footer={
            <>
              <button onClick={() => setShowRemark(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={saveRemark}
                disabled={remarkSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: remarkSaving ? 0.5 : 1 }}
              >
                {remarkSaving ? "Saving..." : "Add Remark"}
              </button>
            </>
          }
        >
          {remarkError && <DialogError message={remarkError} />}
          <textarea
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            placeholder="What happened on this lead?"
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
          />
        </Dialog>

        {/* ── Schedule follow-up ───────────────────────────────────────────── */}
        <Dialog
          open={showFollowUp}
          onClose={() => setShowFollowUp(false)}
          title="Schedule follow-up"
          description={`Book a follow-up with ${lead.name}.`}
          footer={
            <>
              <button onClick={() => setShowFollowUp(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={scheduleFollowUp}
                disabled={fuSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: fuSaving ? 0.5 : 1 }}
              >
                {fuSaving ? "Scheduling..." : "Schedule"}
              </button>
            </>
          }
        >
          {fuError && <DialogError message={fuError} />}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DatePicker value={fuDate} onChange={setFuDate} placeholder="Follow-up date" />
              <input
                type="time"
                value={fuTime}
                onChange={(e) => setFuTime(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>
            <TextInput placeholder="Notes (optional)" value={fuNotes} onChange={setFuNotes} />
          </div>
        </Dialog>
    </>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function HeaderButton({ icon: Icon, label, onClick, primary = false }: {
  icon: typeof Pencil; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
      style={
        primary
          ? { background: "var(--text)", color: "var(--bg)" }
          : { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }
      }
    >
      <Icon size={13} strokeWidth={1.8} />
      {label}
    </button>
  );
}

/** The metric strip's tile. Takes a STRING, unlike the shared InsightCard which
 *  is numbers-only — half of these ("The Tribune", "No Follow-up") aren't
 *  counts, so widening the shared card would have meant every KPI grid in the
 *  app carrying a case it never uses. */
function DetailCard({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Pencil }) {
  return (
    <div className="p-4 rounded-xl flex flex-col items-center gap-2 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{title}</span>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <Icon size={16} strokeWidth={1.6} style={{ color: "var(--text-muted)" }} />
      </div>
      <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium" style={{ color: "var(--text)" }}>{title}</h2>
        {action}
      </div>
      <div className="p-5 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm mt-0.5 break-words" style={{ color: value ? "var(--text)" : "var(--text-faint)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Timeline({ entries }: { entries: LeadHistoryEntry[] }) {
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.id} className="flex gap-3">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--text-faint)" }} />
          <div className="min-w-0">
            <div className="text-xs" style={{ color: "var(--text)" }}>
              {e.type}
              {e.fromValue && e.toValue && (
                <span style={{ color: "var(--text-muted)" }}> · {e.fromValue} → {e.toValue}</span>
              )}
              {!e.fromValue && e.toValue && (
                <span style={{ color: "var(--text-muted)" }}> · {e.toValue}</span>
              )}
            </div>
            {e.remark && (
              <div className="text-xs mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>&ldquo;{e.remark}&rdquo;</div>
            )}
            <div className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
              {e.userName} · {formatWhen(e.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DialogError({ message }: { message: string }) {
  return (
    <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
      {message}
    </div>
  );
}

function TextInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
    />
  );
}
