"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  CircleSlash,
  ExternalLink,
  Globe,
  RefreshCw,
  Repeat,
  Share2,
  ThumbsDown,
  Plus,
  Tag,
  UploadCloud,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import MetricStrip from "@/components/common/MetricStrip";
import RevealOnHover, { RevealLine } from "@/components/common/RevealOnHover";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FilterPills from "@/components/common/FilterPills";
import FollowUpFields from "@/components/common/FollowUpFields";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import PaginationFooter from "@/components/common/PaginationFooter";
import RowActionsMenu from "@/components/common/RowActionsMenu";
import ScoreBar from "@/components/common/ScoreBar";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { TableMessageRow, TableSkeletonRows } from "@/components/common/TableStates";
import { LEAD_STATUS_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import LeadStatusFields from "@/components/leads/LeadStatusFields";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUB_STATUS_BY_STATUS } from "@/lib/leads";
import {
  LeadsApiResponse,
  LeadListItem,
  LeadSummary,
  LeadStatusLabel,
  LeadSubStatusLabel,
  BulkUploadResponse,
  BulkUploadRowError,
} from "@/types/leads";
import { LeadInsightKpis } from "@/types/insights";
import { AgentOption } from "@/types/followups";

const EMPTY_SUMMARY: LeadSummary = {
  total: 0, fresh: 0, interested: 0, converted: 0, closed: 0, irrelevant: 0, reEnquired: 0,
};

// The KPI strip, in the reference's order. Same keys the Dashboard's Lead
// Insights tab uses, rendered with the same MetricStrip — one definition of
// what a "Fresh Lead" is, shown in two places.
const KPI_CARDS: { key: keyof LeadInsightKpis; title: string; icon: LucideIcon }[] = [
  { key: "totalLeads", title: "Total Leads", icon: Globe },
  { key: "freshLeads", title: "Fresh Leads", icon: UserPlus },
  { key: "closedLeads", title: "Closed Leads", icon: CircleSlash },
  { key: "referredLeads", title: "Referred Leads", icon: Share2 },
  { key: "revivedLeads", title: "Revived Leads", icon: RefreshCw },
  { key: "reEnquiredLeads", title: "Re-Enquired Leads", icon: Repeat },
  { key: "convertedLeads", title: "Converted Leads", icon: UserCheck },
  { key: "irrelevantLeads", title: "Irrelevant Leads", icon: ThumbsDown },
];

const ALL_STATUSES = Object.keys(SUB_STATUS_BY_STATUS) as LeadStatusLabel[];
const ALL_SUB_STATUSES = Object.values(SUB_STATUS_BY_STATUS).flat();

// FLAG: the pills ARE the status filter — there is no separate Status dropdown.
// The reference screenshot has both, but two controls writing one piece of
// state is how you end up with a dropdown reading "Fresh" while the active
// pill says "All". "Re-Enquired" is the exception: it's a cross-cutting
// filter (reEnquiryCount > 0), not a sixth status, so it doesn't take part in
// the partition and these counts deliberately don't sum to Total.
const PILLS: { label: string; value: string; key: keyof LeadSummary }[] = [
  { label: "ALL", value: "all", key: "total" },
  { label: "FRESH", value: "Fresh", key: "fresh" },
  { label: "INTERESTED", value: "Interested", key: "interested" },
  { label: "CONVERTED", value: "Converted", key: "converted" },
  { label: "CLOSED", value: "Closed", key: "closed" },
  { label: "IRRELEVANT", value: "Irrelevant", key: "irrelevant" },
  { label: "RE-ENQUIRED", value: "reEnquired", key: "reEnquired" },
];

const SOURCES = ["Direct", "Referral", "Website", "Campaign", "Event", "Other"];
const TABLE_COLUMNS = 7;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function LeadsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [summary, setSummary] = useState<LeadSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // KPI cards — their own fetch, from the same endpoint the Dashboard's Lead
  // Insights tab uses. Scope-wide and all-time on purpose: they answer "how
  // does my book of leads look", which shouldn't move every time someone
  // narrows the table below. The pill counts are the filtered numbers.
  const [kpis, setKpis] = useState<LeadInsightKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [pill, setPill] = useState("all");
  const [subStatus, setSubStatus] = useState("");
  const [source, setSource] = useState("");
  const [agent, setAgent] = useState("");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [agents, setAgents] = useState<AgentOption[]>([]);

  // Add Lead dialog
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", companyName: "",
    location: "", sourceName: "", leadScore: "",
  });
  const [formStatus, setFormStatus] = useState<LeadStatusLabel>("Fresh");
  const [formSubStatus, setFormSubStatus] = useState<LeadSubStatusLabel>("Untouched");
  const [formTemperature, setFormTemperature] = useState("Warm");
  const [formSource, setFormSource] = useState("Direct");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bulk upload dialog
  const [showBulk, setShowBulk] = useState(false);
  const [csvName, setCsvName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkUploadResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status-change dialog — the "lead recording" prompt. Opened from a row's
  // Status cell; the API refuses the change without the remark it collects.
  const [statusFor, setStatusFor] = useState<LeadListItem | null>(null);
  const [newStatus, setNewStatus] = useState<LeadStatusLabel>("Fresh");
  const [newSubStatus, setNewSubStatus] = useState<LeadSubStatusLabel>("Untouched");
  const [remark, setRemark] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  // Schedule-follow-up dialog
  const [followUpFor, setFollowUpFor] = useState<LeadListItem | null>(null);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("09:00");
  const [fuNotes, setFuNotes] = useState("");
  const [fuError, setFuError] = useState("");
  const [fuSaving, setFuSaving] = useState(false);

  const token = () => localStorage.getItem("crm-token");
  const setField = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value });

  const fetchLeads = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({ sort, page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    // One pill drives either the status filter or the re-enquired flag.
    if (pill === "reEnquired") params.set("reEnquired", "true");
    else if (pill !== "all") params.set("status", pill);
    if (subStatus) params.set("subStatus", subStatus);
    if (source) params.set("source", source);
    if (agent) params.set("agent", agent);
    if (location.trim()) params.set("location", location.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: LeadsApiResponse = await res.json();
      setLeads(json.data);
      setSummary(json.summary);
      setTotal(json.total);
      setTotalPages(json.totalPages);
    } catch {
      setError("Failed to load leads. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [sort, page, search, pill, subStatus, source, agent, location, from, to, router]);

  const fetchKpis = useCallback(async () => {
    const t = token();
    if (!t) return;
    setKpisLoading(true);
    try {
      const res = await fetch("/api/insights/summary?tab=lead", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const json = await res.json();
        setKpis(json.kpis as LeadInsightKpis);
      }
    } catch {
      // Non-fatal — the cells fall back to "—" rather than taking the table
      // down with them, since the table is the page's actual job.
    } finally {
      setKpisLoading(false);
    }
  }, []);

  // Covers the initial load plus every non-search filter change.
  useEffect(() => { fetchLeads(); }, [sort, page, pill, subStatus, source, agent, location, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  // Debounced search — FLAG: same fix as Contacts/Deals/Tasks/Follow-ups: skip
  // the mount-time run, since the effect above already fetches on first load.
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) { isFirstSearchRun.current = false; return; }
    const t = setTimeout(() => { setPage(1); fetchLeads(); }, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = token();
    if (!t) return;
    fetch("/api/users/assignable", { headers: { Authorization: `Bearer ${t}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setAgents(json.data); })
      .catch(() => {});
  }, []);

  function clearFilters() {
    setSearch(""); setPill("all"); setSubStatus(""); setSource("");
    setAgent(""); setLocation(""); setFrom(""); setTo(""); setPage(1);
  }

  /** Reloads the table AND the cards — a new lead or a status move changes
   *  both, and refreshing only one leaves the page disagreeing with itself. */
  function refreshAll() {
    fetchLeads();
    fetchKpis();
  }

  // ── Add Lead ──────────────────────────────────────────────────────────────
  function openForm() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", companyName: "", location: "", sourceName: "", leadScore: "" });
    setFormStatus("Fresh");
    setFormSubStatus("Untouched");
    setFormTemperature("Warm");
    setFormSource("Direct");
    setFormError("");
    setShowForm(true);
  }

  async function handleCreate() {
    setFormError("");
    if (!form.firstName.trim()) { setFormError("First name is mandatory"); return; }
    if (!form.lastName.trim()) { setFormError("Last name is mandatory"); return; }
    if (!form.email.trim()) { setFormError("Email is mandatory"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          ...form,
          leadScore: form.leadScore === "" ? undefined : Number(form.leadScore),
          status: formStatus,
          subStatus: formSubStatus,
          temperature: formTemperature,
          source: formSource,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFormError(json.message ?? "Failed to create lead"); return; }

      setShowForm(false);
      showToast("Lead created successfully");
      refreshAll();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Bulk upload ───────────────────────────────────────────────────────────
  function openBulk() {
    setCsvName(""); setCsvText(""); setBulkError(""); setBulkResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowBulk(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkError("");
    setBulkResult(null);

    // Read in the browser but validate on the server — the file's text is all
    // the upload route needs, and every rule about what makes a valid lead
    // stays in one place behind the API.
    const reader = new FileReader();
    reader.onload = () => {
      setCsvName(file.name);
      setCsvText(String(reader.result ?? ""));
    };
    reader.onerror = () => setBulkError("Could not read that file.");
    reader.readAsText(file);
  }

  async function downloadTemplate() {
    try {
      const res = await fetch("/api/leads/bulk", { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) { showToast("Could not download the template", "error"); return; }
      const text = await res.text();

      // Served by the API rather than built here so the columns the user
      // fills in and the columns the importer reads can never diverge.
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "lead-upload-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Could not download the template", "error");
    }
  }

  async function handleUpload() {
    setBulkError("");
    if (!csvText.trim()) { setBulkError("Choose a .csv file first"); return; }

    setUploading(true);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ csv: csvText }),
      });
      const json = await res.json();
      if (!res.ok) { setBulkError(json.message ?? "Failed to import leads"); return; }

      // Kept on screen rather than toasted away — a partial import's skipped
      // rows are the whole point of the response and need reading.
      setBulkResult(json as BulkUploadResponse);
      if (json.created > 0) refreshAll();
    } catch {
      setBulkError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── Status change ─────────────────────────────────────────────────────────
  function openStatus(lead: LeadListItem) {
    setStatusFor(lead);
    setNewStatus(lead.status);
    setNewSubStatus(lead.subStatus);
    setRemark("");
    setStatusError("");
  }

  /** Keeps the sub-status legal for the status above it — picking a new status
   *  snaps the sub-status to that status's first option, the same fallback the
   *  API applies when a caller sends a status alone. */
  function pickStatus(value: string) {
    const status = value as LeadStatusLabel;
    setNewStatus(status);
    setNewSubStatus(SUB_STATUS_BY_STATUS[status][0]);
  }

  async function handleStatusChange() {
    setStatusError("");
    if (!statusFor) return;
    if (!remark.trim()) { setStatusError("A remark is required when a lead's status changes"); return; }

    setStatusSaving(true);
    try {
      const res = await fetch(`/api/leads/${statusFor.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: newStatus, subStatus: newSubStatus, remark: remark.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setStatusError(json.message ?? "Failed to update status"); return; }

      setStatusFor(null);
      showToast(json.message ?? "Status updated");
      refreshAll();
    } catch {
      setStatusError("Network error. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  }

  // ── Schedule follow-up ────────────────────────────────────────────────────
  function openFollowUp(lead: LeadListItem) {
    setFollowUpFor(lead);
    setFuDate(""); setFuTime("09:00"); setFuNotes(""); setFuError("");
  }

  async function handleScheduleFollowUp() {
    setFuError("");
    if (!followUpFor) return;
    if (!fuDate) { setFuError("Follow-up date is mandatory"); return; }

    setFuSaving(true);
    try {
      // The same endpoint the Follow-up page and the Contacts row button use,
      // so a follow-up booked here shows up there immediately.
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          contactId: followUpFor.id,
          scheduledDate: fuDate,
          scheduledTime: fuTime || undefined,
          notes: fuNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setFuError(json.message ?? "Failed to schedule follow-up"); return; }

      setFollowUpFor(null);
      showToast("Follow-up scheduled successfully");
      fetchLeads();
    } catch {
      setFuError("Network error. Please try again.");
    } finally {
      setFuSaving(false);
    }
  }

  const hasFilters = !!(search || pill !== "all" || subStatus || source || agent || location || from || to);

  // When a status is picked, the Sub-Status filter narrows to that status's
  // own options — offering "Won" under Fresh would be a filter that can only
  // ever return nothing.
  const subStatusOptions =
    pill !== "all" && pill !== "reEnquired"
      ? SUB_STATUS_BY_STATUS[pill as LeadStatusLabel]
      : ALL_SUB_STATUSES;

  return (
    <>
        <PageHeader
          title={
            <span className="font-medium text-foreground">
              Leads {total > 0 && <span className="text-muted-foreground">· {total}</span>}
            </span>
          }
        >
          <Button variant="outline" size="sm" onClick={openBulk} aria-label="Bulk Upload">
            <UploadCloud aria-hidden />
            <span className="hidden sm:inline">Bulk Upload</span>
          </Button>
          <Button size="sm" onClick={openForm} aria-label="Add Lead">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Add Lead</span>
          </Button>
        </PageHeader>

        <div className="space-y-4">
          {/* KPI strip */}
          <div className="space-y-2">
            <MetricStrip
              perRow={4}
              loading={kpisLoading}
              metrics={KPI_CARDS.map((card) => ({
                label: card.title,
                value: kpis ? kpis[card.key].toLocaleString() : "—",
                icon: card.icon,
              }))}
            />
            <p className="text-xs text-faint">
              These cards cover every lead you have access to, not the filters below — the pill counts are the filtered numbers.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, email, phone..."
              className="w-full sm:w-56"
            />

            <Select
              value={subStatus}
              onChange={(v) => { setSubStatus(v); setPage(1); }}
              placeholder="Sub-Status"
              className="w-40"
              options={[{ label: "All sub-statuses", value: "" }, ...subStatusOptions.map((s) => ({ label: s, value: s }))]}
            />

            <Select
              value={source}
              onChange={(v) => { setSource(v); setPage(1); }}
              placeholder="Source"
              className="w-32"
              options={[
                { label: "All sources", value: "" },
                ...SOURCES.map((s) => ({ label: s, value: s })),
              ]}
            />

            <Select
              value={agent}
              onChange={(v) => { setAgent(v); setPage(1); }}
              placeholder="Agent"
              className="w-36"
              options={[{ label: "All agents", value: "" }, ...agents.map((a) => ({ label: a.name, value: a.id }))]}
            />

            <Input
              value={location}
              onChange={(e) => { setLocation(e.target.value); setPage(1); }}
              placeholder="Location"
              aria-label="Location"
              className="w-28"
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
              value={pill}
              onChange={(value) => {
                setPill(value);
                // A sub-status that isn't legal under the new status would
                // silently return nothing, so it's dropped on the switch.
                setSubStatus("");
                setPage(1);
              }}
              options={PILLS.map((p) => ({ label: p.label, value: p.value, count: summary[p.key] }))}
            />
            <Select
              value={sort}
              onChange={setSort}
              className="w-44"
              align="right"
              options={[
                { label: "Newest first", value: "createdAt" },
                { label: "Oldest first", value: "createdAtAsc" },
                { label: "Name (A–Z)", value: "name" },
                { label: "Highest score", value: "leadScore" },
              ]}
            />
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-4 text-xs">Name</TableHead>
                  <TableHead className="px-4 text-xs">Status</TableHead>
                  <TableHead className="px-4 text-xs">Score</TableHead>
                  <TableHead className="px-4 text-xs">Next Follow-up</TableHead>
                  <TableHead className="px-4 text-xs">Agent</TableHead>
                  <TableHead className="px-4 text-xs">Source</TableHead>
                  <TableHead className="px-4 text-right text-xs">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows columns={TABLE_COLUMNS} />}

                {!loading && !error && leads.length === 0 && (
                  <TableMessageRow colSpan={TABLE_COLUMNS}>No leads found</TableMessageRow>
                )}

                {!loading && !error && leads.map((lead) => (
                  // `group/row` drives the RevealOnHover cell below — in CSS, not
                  // React state, so hovering down a 20-row table re-renders nothing.
                  <TableRow key={lead.id} className="group/row">
                    <TableCell className="max-w-[260px] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <InitialsAvatar name={lead.name} />
                        <div className="min-w-0 flex-1 pt-1">
                          <RevealOnHover primary={<span className="font-medium">{lead.name}</span>}>
                            <RevealLine>{lead.phone ?? "—"} · {lead.email}</RevealLine>
                            <RevealLine tone="faint">
                              {lead.company ?? "No company"} · {lead.leadAge}d old
                              {lead.reEnquiryCount > 0 && ` · re-enquired ${lead.reEnquiryCount}×`}
                            </RevealLine>
                          </RevealOnHover>
                        </div>
                      </div>
                    </TableCell>

                    {/* Status is the button — clicking it opens the change prompt,
                        so a lead can be moved without leaving the list. */}
                    <TableCell className="px-4 py-3">
                      <button type="button" onClick={() => openStatus(lead)} className="rounded-md text-left" title="Change status">
                        <StatusBadge color={LEAD_STATUS_COLOR[lead.status]}>{lead.status}</StatusBadge>
                        <div className="mt-1 text-xs text-muted-foreground">{lead.subStatus}</div>
                      </button>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <ScoreBar value={lead.leadScore} />
                    </TableCell>

                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      {lead.nextFollowUpAt ? formatWhen(lead.nextFollowUpAt) : "Not Scheduled"}
                      <button
                        type="button"
                        onClick={() => openFollowUp(lead)}
                        aria-label={`Schedule follow-up with ${lead.name}`}
                        title="Schedule follow-up"
                        className="mt-1 flex items-center gap-1 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <CalendarClock className="size-3.5" aria-hidden />
                        <span>Schedule</span>
                      </button>
                    </TableCell>

                    <TableCell className="max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {lead.agentName}
                    </TableCell>

                    <TableCell className="max-w-[140px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {lead.sourceName ?? lead.source}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <RowActionsMenu label={`Actions for ${lead.name}`}>
                          <DropdownMenuItem onSelect={() => router.push(`/leads/${lead.id}`)}>
                            <ExternalLink aria-hidden />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => openStatus(lead)}>
                            <Tag aria-hidden />
                            Change status
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openFollowUp(lead)}>
                            <CalendarClock aria-hidden />
                            Schedule follow-up
                          </DropdownMenuItem>
                        </RowActionsMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => router.push(`/leads/${lead.id}`)}
                          aria-label={`Open ${lead.name}`}
                        >
                          <ChevronRight aria-hidden />
                        </Button>
                      </div>
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

        {/* ── Add Lead ─────────────────────────────────────────────────────── */}
        <Dialog
          open={showForm}
          onClose={() => setShowForm(false)}
          title="Add Lead"
          description="Create a single lead by hand."
          maxWidth="560px"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating..." : "Create Lead"}
              </Button>
            </>
          }
        >
          {formError && <ErrorBanner className="mb-4">{formError}</ErrorBanner>}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First name *" htmlFor="lead-first-name">
                <Input id="lead-first-name" value={form.firstName} onChange={(e) => setField("firstName")(e.target.value)} />
              </FormField>
              <FormField label="Last name *" htmlFor="lead-last-name">
                <Input id="lead-last-name" value={form.lastName} onChange={(e) => setField("lastName")(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Email *" htmlFor="lead-email">
              <Input id="lead-email" value={form.email} onChange={(e) => setField("email")(e.target.value)} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" htmlFor="lead-phone">
                <Input id="lead-phone" value={form.phone} onChange={(e) => setField("phone")(e.target.value)} />
              </FormField>
              <FormField label="Company" htmlFor="lead-company">
                <Input id="lead-company" value={form.companyName} onChange={(e) => setField("companyName")(e.target.value)} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Status" htmlFor="lead-status">
                <Select
                  id="lead-status"
                  value={formStatus}
                  onChange={(v) => {
                    const s = v as LeadStatusLabel;
                    setFormStatus(s);
                    setFormSubStatus(SUB_STATUS_BY_STATUS[s][0]);
                  }}
                  options={ALL_STATUSES.map((s) => ({ label: s, value: s }))}
                />
              </FormField>
              <FormField label="Sub-status" htmlFor="lead-sub-status">
                <Select
                  id="lead-sub-status"
                  value={formSubStatus}
                  onChange={(v) => setFormSubStatus(v as LeadSubStatusLabel)}
                  options={SUB_STATUS_BY_STATUS[formStatus].map((s) => ({ label: s, value: s }))}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Source" htmlFor="lead-source">
                <Select
                  id="lead-source"
                  value={formSource}
                  onChange={setFormSource}
                  options={SOURCES.map((s) => ({ label: s, value: s }))}
                />
              </FormField>
              <FormField label="Source name" htmlFor="lead-source-name">
                <Input id="lead-source-name" placeholder="e.g. The Tribune" value={form.sourceName} onChange={(e) => setField("sourceName")(e.target.value)} />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Temperature" htmlFor="lead-temperature">
                <Select
                  id="lead-temperature"
                  value={formTemperature}
                  onChange={setFormTemperature}
                  options={["Hot", "Warm", "Cold"].map((s) => ({ label: s, value: s }))}
                />
              </FormField>
              <FormField label="Location" htmlFor="lead-location">
                <Input id="lead-location" value={form.location} onChange={(e) => setField("location")(e.target.value)} />
              </FormField>
              <FormField label="Score" htmlFor="lead-score">
                <Input
                  id="lead-score"
                  inputMode="numeric"
                  placeholder="0–100"
                  value={form.leadScore}
                  onChange={(e) => setField("leadScore")(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </FormField>
            </div>
          </div>
        </Dialog>

        {/* ── Bulk upload ──────────────────────────────────────────────────── */}
        <Dialog
          open={showBulk}
          onClose={() => setShowBulk(false)}
          title="Bulk Upload Leads"
          description="Import many leads at once from a .csv file."
          maxWidth="560px"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowBulk(false)}>
                {bulkResult ? "Close" : "Cancel"}
              </Button>
              {!bulkResult && (
                <Button onClick={handleUpload} disabled={uploading || !csvText}>
                  {uploading ? "Importing..." : "Import"}
                </Button>
              )}
            </>
          }
        >
          {bulkError && <ErrorBanner className="mb-4">{bulkError}</ErrorBanner>}

          {!bulkResult ? (
            <div className="space-y-3">
              <Button variant="link" onClick={downloadTemplate} className="h-auto p-0 text-xs text-muted-foreground">
                Download the CSV template
              </Button>

              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 py-8 transition-colors
                           hover:bg-muted focus-within:ring-1 focus-within:ring-ring"
              >
                <UploadCloud className="size-5 text-muted-foreground" aria-hidden />
                <span className="text-xs text-foreground">
                  {csvName || "Choose a .csv file"}
                </span>
                <span className="text-xs text-faint">
                  First name, last name and email are required
                </span>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
              </label>
            </div>
          ) : (
            // The report. Every skipped row is named with its spreadsheet line
            // number and the reason, so the file can be fixed and re-uploaded
            // without guessing which rows went in.
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-success">{bulkResult.created} imported</span>
                {bulkResult.failed > 0 && <span className="text-danger">{bulkResult.failed} skipped</span>}
              </div>

              {bulkResult.errors.length > 0 && (
                <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
                  {bulkResult.errors.map((e: BulkUploadRowError, i) => (
                    <div key={`${e.row}-${i}`} className="px-3 py-2 text-xs">
                      <span className="text-foreground">Row {e.row}</span>
                      <span className="text-muted-foreground"> · {e.name}</span>
                      <div className="text-danger">{e.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Dialog>

        {/* ── Status change — the lead recording prompt ─────────────────────── */}
        <Dialog
          open={!!statusFor}
          onClose={() => setStatusFor(null)}
          title="Change lead status"
          description={statusFor ? `Move ${statusFor.name} to a new status. A remark is required.` : ""}
          footer={
            <>
              <Button variant="ghost" onClick={() => setStatusFor(null)}>
                Cancel
              </Button>
              <Button onClick={handleStatusChange} disabled={statusSaving}>
                {statusSaving ? "Saving..." : "Save & Record"}
              </Button>
            </>
          }
        >
          {statusError && <ErrorBanner className="mb-4">{statusError}</ErrorBanner>}
          <LeadStatusFields
            idPrefix="list-status"
            status={newStatus}
            onStatusChange={pickStatus}
            subStatus={newSubStatus}
            onSubStatusChange={setNewSubStatus}
            remark={remark}
            onRemarkChange={setRemark}
            hint="This is saved onto the lead's history against this exact change."
          />
        </Dialog>

        {/* ── Schedule follow-up ───────────────────────────────────────────── */}
        <Dialog
          open={!!followUpFor}
          onClose={() => setFollowUpFor(null)}
          title="Schedule follow-up"
          description={followUpFor ? `Book a follow-up with ${followUpFor.name}.` : ""}
          footer={
            <>
              <Button variant="ghost" onClick={() => setFollowUpFor(null)}>
                Cancel
              </Button>
              <Button onClick={handleScheduleFollowUp} disabled={fuSaving}>
                {fuSaving ? "Scheduling..." : "Schedule"}
              </Button>
            </>
          }
        >
          {fuError && <ErrorBanner className="mb-4">{fuError}</ErrorBanner>}
          <FollowUpFields
            idPrefix="list-follow-up"
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
