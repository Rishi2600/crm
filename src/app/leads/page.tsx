"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  CircleSlash,
  Globe,
  RefreshCw,
  Repeat,
  Share2,
  ThumbsDown,
  UploadCloud,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import InsightCard from "@/components/insights/InsightCard";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import LoadingState from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
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
// Insights tab uses, rendered with the same InsightCard — one definition of
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

// 🚩 The pills ARE the status filter — there is no separate Status dropdown.
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
      // Non-fatal — the cards fall back to "—" rather than taking the table
      // down with them, since the table is the page's actual job.
    } finally {
      setKpisLoading(false);
    }
  }, []);

  // Covers the initial load plus every non-search filter change.
  useEffect(() => { fetchLeads(); }, [sort, page, pill, subStatus, source, agent, location, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  // Debounced search — 🚩 same fix as Contacts/Deals/Tasks/Follow-ups: skip
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
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        <div className="h-14 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Leads {total > 0 && <span style={{ color: "var(--text-muted)" }}>· {total}</span>}
          </span>
          <ThemeToggle />
        </div>

        <div className="p-8 space-y-5">
          {/* KPI cards */}
          <div>
            <div className="grid gap-3 grid-cols-4">
              {KPI_CARDS.map((card) => (
                <InsightCard
                  key={card.key}
                  title={card.title}
                  value={kpis ? kpis[card.key] : 0}
                  icon={card.icon}
                  loading={kpisLoading || !kpis}
                />
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>
              These cards cover every lead you have access to, not the filters below — the pill counts are the filtered numbers.
            </p>
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
                  placeholder="Search by name, email, phone..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                />
              </div>

              <Select
                value={subStatus}
                onChange={(v) => { setSubStatus(v); setPage(1); }}
                placeholder="Sub-Status"
                className="w-44"
                options={[{ label: "All sub-statuses", value: "" }, ...subStatusOptions.map((s) => ({ label: s, value: s }))]}
              />

              <Select
                value={source}
                onChange={(v) => { setSource(v); setPage(1); }}
                placeholder="Source"
                className="w-36"
                options={[
                  { label: "All sources", value: "" },
                  ...["Direct", "Referral", "Website", "Campaign", "Event", "Other"].map((s) => ({ label: s, value: s })),
                ]}
              />

              <Select
                value={agent}
                onChange={(v) => { setAgent(v); setPage(1); }}
                placeholder="Agent"
                className="w-40"
                options={[{ label: "All agents", value: "" }, ...agents.map((a) => ({ label: a.name, value: a.id }))]}
              />

              <input
                value={location}
                onChange={(e) => { setLocation(e.target.value); setPage(1); }}
                placeholder="Location"
                className="w-32 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
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
                  { label: "Newest first", value: "createdAt" },
                  { label: "Oldest first", value: "createdAtAsc" },
                  { label: "Name (A–Z)", value: "name" },
                  { label: "Highest score", value: "leadScore" },
                ]}
              />
              <button
                onClick={openBulk}
                className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                <UploadCloud size={13} strokeWidth={1.8} />
                Bulk Upload
              </button>
              <button
                onClick={openForm}
                className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                + Add Lead
              </button>
            </div>
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {PILLS.map((p) => {
              const isActive = pill === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => {
                    setPill(p.value);
                    // A sub-status that isn't legal under the new status would
                    // silently return nothing, so it's dropped on the switch.
                    setSubStatus("");
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: isActive ? "var(--text)" : "var(--bg-subtle)",
                    color: isActive ? "var(--bg)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {p.label} ({summary[p.key]})
                </button>
              );
            })}
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)" }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium" style={{
              background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)",
            }}>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-center">Score</div>
              <div className="col-span-2">Next Follow-up</div>
              <div className="col-span-2">Agent</div>
              <div className="col-span-1">Source</div>
              <div className="col-span-1 text-center">Open</div>
            </div>

            {loading && <LoadingState variant="inline" />}

            {!loading && !error && leads.length === 0 && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No leads found
              </div>
            )}

            {!loading && !error && leads.map((lead, i) => (
              <div
                key={lead.id}
                className="grid grid-cols-12 px-4 py-3 text-sm items-center"
                style={{ borderBottom: i < leads.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="col-span-3 min-w-0">
                  <button
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="text-left hover:underline truncate block w-full"
                    style={{ color: "var(--text)" }}
                  >
                    {lead.name}
                  </button>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {lead.phone ?? "—"} · {lead.email}
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>
                    {lead.company ?? "No company"} · {lead.leadAge}d old
                    {lead.reEnquiryCount > 0 && ` · re-enquired ${lead.reEnquiryCount}×`}
                  </div>
                </div>

                {/* Status is the button — clicking it opens the change prompt,
                    so a lead can be moved without leaving the list. */}
                <div className="col-span-2">
                  <button onClick={() => openStatus(lead)} className="text-left" title="Change status">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[lead.status] }} />
                      <span style={{ color: "var(--text)" }}>{lead.status}</span>
                    </span>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{lead.subStatus}</div>
                  </button>
                </div>

                <div className="col-span-1 text-center text-xs tabular-nums" style={{ color: "var(--text)" }}>
                  {lead.leadScore}
                </div>

                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {lead.nextFollowUpAt ? formatWhen(lead.nextFollowUpAt) : "Not Scheduled"}
                  <button
                    onClick={() => openFollowUp(lead)}
                    aria-label={`Schedule follow-up with ${lead.name}`}
                    title="Schedule follow-up"
                    className="mt-1 flex items-center gap-1"
                    style={{ color: "var(--text-faint)" }}
                  >
                    <CalendarClock size={13} strokeWidth={1.8} />
                    <span className="text-xs">Schedule</span>
                  </button>
                </div>

                <div className="col-span-2 text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {lead.agentName}
                </div>

                <div className="col-span-1 text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {lead.sourceName ?? lead.source}
                </div>

                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    aria-label={`Open ${lead.name}`}
                    style={{ color: "var(--text-faint)" }}
                  >
                    <ChevronRight size={16} strokeWidth={1.8} />
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
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", opacity: page === 1 ? 0.4 : 1 }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? "Creating..." : "Create Lead"}
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
            <div className="grid grid-cols-2 gap-3">
              <FormInput placeholder="First name *" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
              <FormInput placeholder="Last name *" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
            </div>
            <FormInput placeholder="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <div className="grid grid-cols-2 gap-3">
              <FormInput placeholder="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <FormInput placeholder="Company" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={formStatus}
                onChange={(v) => {
                  const s = v as LeadStatusLabel;
                  setFormStatus(s);
                  setFormSubStatus(SUB_STATUS_BY_STATUS[s][0]);
                }}
                options={ALL_STATUSES.map((s) => ({ label: s, value: s }))}
              />
              <Select
                value={formSubStatus}
                onChange={(v) => setFormSubStatus(v as LeadSubStatusLabel)}
                options={SUB_STATUS_BY_STATUS[formStatus].map((s) => ({ label: s, value: s }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={formSource}
                onChange={setFormSource}
                options={["Direct", "Referral", "Website", "Campaign", "Event", "Other"].map((s) => ({ label: s, value: s }))}
              />
              <FormInput placeholder="Source name (e.g. The Tribune)" value={form.sourceName} onChange={(v) => setForm({ ...form, sourceName: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Select
                value={formTemperature}
                onChange={setFormTemperature}
                options={["Hot", "Warm", "Cold"].map((s) => ({ label: s, value: s }))}
              />
              <FormInput placeholder="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              <FormInput placeholder="Score 0–100" value={form.leadScore} onChange={(v) => setForm({ ...form, leadScore: v.replace(/[^0-9]/g, "") })} />
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
              <button onClick={() => setShowBulk(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {bulkResult ? "Close" : "Cancel"}
              </button>
              {!bulkResult && (
                <button
                  onClick={handleUpload}
                  disabled={uploading || !csvText}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "var(--text)", color: "var(--bg)", opacity: uploading || !csvText ? 0.5 : 1 }}
                >
                  {uploading ? "Importing..." : "Import"}
                </button>
              )}
            </>
          }
        >
          {bulkError && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
              {bulkError}
            </div>
          )}

          {!bulkResult ? (
            <div className="space-y-3">
              <button onClick={downloadTemplate} className="text-xs underline" style={{ color: "var(--text-muted)" }}>
                Download the CSV template
              </button>

              <label
                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer"
                style={{ background: "var(--bg-subtle)", border: "1px dashed var(--border)" }}
              >
                <UploadCloud size={20} strokeWidth={1.6} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs" style={{ color: "var(--text)" }}>
                  {csvName || "Choose a .csv file"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  First name, last name and email are required
                </span>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
              </label>
            </div>
          ) : (
            // The report. Every skipped row is named with its spreadsheet line
            // number and the reason, so the file can be fixed and re-uploaded
            // without guessing which rows went in.
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <span style={{ color: "var(--green)" }}>{bulkResult.created} imported</span>
                {bulkResult.failed > 0 && <span style={{ color: "var(--red)" }}>{bulkResult.failed} skipped</span>}
              </div>

              {bulkResult.errors.length > 0 && (
                <div className="rounded-lg max-h-64 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                  {bulkResult.errors.map((e: BulkUploadRowError, i) => (
                    <div
                      key={`${e.row}-${i}`}
                      className="px-3 py-2 text-xs"
                      style={{ borderBottom: i < bulkResult.errors.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <span style={{ color: "var(--text)" }}>Row {e.row}</span>
                      <span style={{ color: "var(--text-muted)" }}> · {e.name}</span>
                      <div style={{ color: "var(--red)" }}>{e.reason}</div>
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
              <button onClick={() => setStatusFor(null)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={statusSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: statusSaving ? 0.5 : 1 }}
              >
                {statusSaving ? "Saving..." : "Save & Record"}
              </button>
            </>
          }
        >
          {statusError && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
              {statusError}
            </div>
          )}
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
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              This is saved onto the lead&apos;s history against this exact change.
            </p>
          </div>
        </Dialog>

        {/* ── Schedule follow-up ───────────────────────────────────────────── */}
        <Dialog
          open={!!followUpFor}
          onClose={() => setFollowUpFor(null)}
          title="Schedule follow-up"
          description={followUpFor ? `Book a follow-up with ${followUpFor.name}.` : ""}
          footer={
            <>
              <button onClick={() => setFollowUpFor(null)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={handleScheduleFollowUp}
                disabled={fuSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: fuSaving ? 0.5 : 1 }}
              >
                {fuSaving ? "Scheduling..." : "Schedule"}
              </button>
            </>
          }
        >
          {fuError && (
            <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
              {fuError}
            </div>
          )}
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
            <FormInput placeholder="Notes (optional)" value={fuNotes} onChange={setFuNotes} />
          </div>
        </Dialog>
      </main>
    </div>
  );
}

/** The one text input every dialog on this page uses — keeps 12 identical
 *  style objects from being pasted 12 times. */
function FormInput({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
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
