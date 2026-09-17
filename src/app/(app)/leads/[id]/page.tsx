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
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FollowUpFields from "@/components/common/FollowUpFields";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import MetricStrip from "@/components/common/MetricStrip";
import SectionCard from "@/components/common/SectionCard";
import StatusBadge from "@/components/common/StatusBadge";
import { LEAD_STATUS_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import LeadStatusFields from "@/components/leads/LeadStatusFields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SUB_STATUS_BY_STATUS } from "@/lib/leads";
import {
  LeadDetail,
  LeadDetailResponse,
  LeadStatusLabel,
  LeadSubStatusLabel,
  LeadHistoryEntry,
} from "@/types/leads";
import { AgentOption } from "@/types/followups";

const SOURCES = ["Direct", "Referral", "Website", "Campaign", "Event", "Other"];
const TEMPERATURES = ["Hot", "Warm", "Cold"];

const METRIC_LABELS = ["Lead Age", "Temperature", "Source Name", "Re-Enquired", "Last Follow-up", "Lead Score"];

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
  const setEditField = (key: keyof typeof edit) => (value: string) => setEdit({ ...edit, [key]: value });

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
          className="flex items-center gap-2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Leads
        </button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {backToLeads}
        <div className="space-y-4" aria-busy="true" aria-label="Loading lead">
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </Card>
          <MetricStrip perRow={6} compact loading metrics={METRIC_LABELS.map((label) => ({ label, value: null }))} />
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-4 p-5">
              <Skeleton className="h-4 w-32" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-9 w-full" />)}
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (error || !lead) {
    return (
      <>
        {backToLeads}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/leads")} className="-ml-2 text-muted-foreground">
            <ArrowLeft aria-hidden /> Back to Leads
          </Button>
          <ErrorBanner>{error || "Lead not found"}</ErrorBanner>
        </div>
      </>
    );
  }

  const historyEntries = historyView === "assignments" ? lead.assignmentTrail : lead.history;

  return (
    <>
        {backToLeads}

        <div className="space-y-4">
          {/* Header */}
          <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              <div className="flex items-start gap-4">
                <InitialsAvatar name={lead.name} className="size-12" />
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">{lead.name}</h1>
                  <div className="mt-0.5 break-all text-xs text-muted-foreground">
                    Lead Id: {lead.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatWhen(lead.createdAt)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Status</div>
                <button type="button" onClick={openStatus} className="rounded-md text-left" title="Change status">
                  <StatusBadge color={LEAD_STATUS_COLOR[lead.status]}>{lead.status}</StatusBadge>
                  <div className="mt-1 text-xs text-muted-foreground">{lead.subStatus}</div>
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Agent</div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <InitialsAvatar name={lead.agentName} className="size-6" />
                  {lead.agentName}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <HeaderButton icon={RouteIcon} label="Assignment Trail" onClick={() => setHistoryView("assignments")} />
              <HeaderButton icon={History} label="History" onClick={() => setHistoryView("all")} />
              <HeaderButton icon={MessageSquarePlus} label="Add Remark" onClick={() => { setNewRemark(""); setRemarkError(""); setShowRemark(true); }} />
              <HeaderButton icon={CalendarClock} label="Follow-up" onClick={() => { setFuError(""); setShowFollowUp(true); }} />
              <HeaderButton icon={Pencil} label="Edit" onClick={openEdit} primary />
            </div>
          </Card>

          {/* Metric strip */}
          <MetricStrip
            perRow={6}
            compact
            metrics={[
              { label: "Lead Age", value: `${lead.leadAge} Days`, icon: Timer },
              { label: "Temperature", value: lead.temperature, icon: Gauge },
              { label: "Source Name", value: lead.sourceName ?? lead.source, icon: Radio },
              { label: "Re-Enquired", value: String(lead.reEnquiryCount), icon: Repeat },
              { label: "Last Follow-up", value: lead.lastFollowUpAt ? formatWhen(lead.lastFollowUpAt) : "No Follow-up", icon: CalendarClock },
              { label: "Lead Score", value: String(lead.leadScore), icon: Gauge },
            ]}
          />

          {/* Personal details */}
          <SectionCard
            title="Personal Details"
            action={<IconAction icon={Pencil} label="Edit details" onClick={openEdit} />}
          >
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
            </dl>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Last remark */}
            <SectionCard
              title="Last Lead Remark"
              action={<IconAction icon={History} label="View full history" onClick={() => setHistoryView("all")} />}
            >
              {lead.lastRemark ? (
                <div>
                  <div className="text-sm text-foreground">{lead.lastRemark.remark}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {lead.lastRemark.userName} · {formatWhen(lead.lastRemark.createdAt)} · {lead.lastRemark.type}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No Remarks</div>
              )}
            </SectionCard>

            {/* Timeline — the most recent entries inline, the rest behind the
                History button, so the page opens on what matters without
                becoming a wall of audit rows. */}
            <SectionCard title="Recent Activity">
              {lead.history.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nothing recorded yet</div>
              ) : (
                <>
                  <Timeline entries={lead.history.slice(0, 5)} />
                  {lead.history.length > 5 && (
                    <Button variant="link" onClick={() => setHistoryView("all")} className="mt-3 h-auto p-0 text-xs text-muted-foreground">
                      View all {lead.history.length} entries
                    </Button>
                  )}
                </>
              )}
            </SectionCard>
          </div>
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
            <Button variant="ghost" onClick={() => setHistoryView(null)}>
              Close
            </Button>
          }
        >
          {historyEntries.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nothing recorded yet</div>
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
              <Button variant="ghost" onClick={() => setShowStatus(false)}>
                Cancel
              </Button>
              <Button onClick={saveStatus} disabled={statusSaving}>
                {statusSaving ? "Saving..." : "Save & Record"}
              </Button>
            </>
          }
        >
          {statusError && <ErrorBanner className="mb-4">{statusError}</ErrorBanner>}
          <LeadStatusFields
            idPrefix="detail-status"
            status={newStatus}
            onStatusChange={pickStatus}
            subStatus={newSubStatus}
            onSubStatusChange={setNewSubStatus}
            remark={remark}
            onRemarkChange={setRemark}
          />
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
              <Button variant="ghost" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          }
        >
          {editError && <ErrorBanner className="mb-4">{editError}</ErrorBanner>}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name *" htmlFor="edit-first-name">
                <Input id="edit-first-name" value={edit.firstName} onChange={(e) => setEditField("firstName")(e.target.value)} />
              </FormField>
              <FormField label="Last name *" htmlFor="edit-last-name">
                <Input id="edit-last-name" value={edit.lastName} onChange={(e) => setEditField("lastName")(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Email *" htmlFor="edit-email">
              <Input id="edit-email" value={edit.email} onChange={(e) => setEditField("email")(e.target.value)} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" htmlFor="edit-phone">
                <Input id="edit-phone" value={edit.phone} onChange={(e) => setEditField("phone")(e.target.value)} />
              </FormField>
              <FormField label="Company" htmlFor="edit-company">
                <Input id="edit-company" value={edit.companyName} onChange={(e) => setEditField("companyName")(e.target.value)} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Source" htmlFor="edit-source">
                <Select id="edit-source" value={editSource} onChange={setEditSource} options={SOURCES.map((s) => ({ label: s, value: s }))} />
              </FormField>
              <FormField label="Source name" htmlFor="edit-source-name">
                <Input id="edit-source-name" value={edit.sourceName} onChange={(e) => setEditField("sourceName")(e.target.value)} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Temperature" htmlFor="edit-temperature">
                <Select id="edit-temperature" value={editTemperature} onChange={setEditTemperature} options={TEMPERATURES.map((s) => ({ label: s, value: s }))} />
              </FormField>
              <FormField label="Location" htmlFor="edit-location">
                <Input id="edit-location" value={edit.location} onChange={(e) => setEditField("location")(e.target.value)} />
              </FormField>
              <FormField label="Score" htmlFor="edit-score">
                <Input
                  id="edit-score"
                  inputMode="numeric"
                  placeholder="0–100"
                  value={edit.leadScore}
                  onChange={(e) => setEditField("leadScore")(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </FormField>
            </div>
            <FormField label="Assigned agent" htmlFor="edit-agent">
              <Select
                id="edit-agent"
                value={editAgent}
                onChange={setEditAgent}
                options={agents.map((a) => ({ label: a.name, value: a.id }))}
              />
            </FormField>
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
              <Button variant="ghost" onClick={() => setShowRemark(false)}>
                Cancel
              </Button>
              <Button onClick={saveRemark} disabled={remarkSaving}>
                {remarkSaving ? "Saving..." : "Add Remark"}
              </Button>
            </>
          }
        >
          {remarkError && <ErrorBanner className="mb-4">{remarkError}</ErrorBanner>}
          <FormField label="Remark" htmlFor="detail-remark">
            <Textarea
              id="detail-remark"
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              placeholder="What happened on this lead?"
              rows={4}
              className="resize-none"
            />
          </FormField>
        </Dialog>

        {/* ── Schedule follow-up ───────────────────────────────────────────── */}
        <Dialog
          open={showFollowUp}
          onClose={() => setShowFollowUp(false)}
          title="Schedule follow-up"
          description={`Book a follow-up with ${lead.name}.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowFollowUp(false)}>
                Cancel
              </Button>
              <Button onClick={scheduleFollowUp} disabled={fuSaving}>
                {fuSaving ? "Scheduling..." : "Schedule"}
              </Button>
            </>
          }
        >
          {fuError && <ErrorBanner className="mb-4">{fuError}</ErrorBanner>}
          <FollowUpFields
            idPrefix="detail-follow-up"
            date={fuDate}
            onDateChange={setFuDate}
            time={fuTime}
            onTimeChange={setFuTime}
            notes={fuNotes}
            onNotesChange={setFuNotes}
          />
        </Dialog>
    </>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function HeaderButton({ icon: Icon, label, onClick, primary = false }: {
  icon: typeof Pencil; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <Button variant={primary ? "default" : "outline"} onClick={onClick} className="whitespace-nowrap">
      <Icon aria-hidden />
      {label}
    </Button>
  );
}

function IconAction({ icon: Icon, label, onClick }: { icon: typeof Pencil; label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={onClick} aria-label={label} title={label}>
      <Icon aria-hidden />
    </Button>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={value ? "mt-0.5 break-words text-sm text-foreground" : "mt-0.5 text-sm text-faint"}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Timeline({ entries }: { entries: LeadHistoryEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-faint" aria-hidden />
          <div className="min-w-0">
            <div className="text-xs text-foreground">
              {e.type}
              {e.fromValue && e.toValue && (
                <span className="text-muted-foreground"> · {e.fromValue} → {e.toValue}</span>
              )}
              {!e.fromValue && e.toValue && (
                <span className="text-muted-foreground"> · {e.toValue}</span>
              )}
            </div>
            {e.remark && (
              <div className="mt-0.5 break-words text-xs text-muted-foreground">&ldquo;{e.remark}&rdquo;</div>
            )}
            <div className="mt-0.5 text-xs text-faint">
              {e.userName} · {formatWhen(e.createdAt)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
