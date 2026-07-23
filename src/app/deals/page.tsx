"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import Dialog from "@/components/ui/Dialog";
import LoadingState from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
import { Trash2 } from "lucide-react";
import { DealsPipelineResponse, DealCardResponse, DealStageSummary } from "@/types/deals";

interface ContactOption { id: string; name: string; }

const STAGES = ["Qualification", "Proposal", "Negotiation", "Closed Won"];

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Derives the same shape the backend's summary array returns, but purely
// from data already sitting in state — no network round trip. Used after a
// successful drag so the count/total cards update instantly instead of
// waiting on (and visually flashing through) a full refetch.
function computeSummary(pipeline: DealCardResponse[]): DealStageSummary[] {
  return STAGES.map((stage) => {
    const dealsInStage = pipeline.filter((d) => d.stage === stage);
    return {
      stage,
      count: dealsInStage.length,
      totalAmount: dealsInStage.reduce((sum, d) => sum + d.amount, 0),
    };
  });
}

export default function DealsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pipeline, setPipeline] = useState<DealCardResponse[]>([]);
  const [summary, setSummary] = useState<DealStageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"amount" | "expectedCloseDate" | "createdAt">("createdAt");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create Deal dialog
  const [showForm, setShowForm] = useState(false);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("Qualification");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPipeline = useCallback(async () => {
    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({ sort });
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/deals/pipeline?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: DealsPipelineResponse = await res.json();
      setPipeline(json.pipeline);
      setSummary(json.summary);
    } catch {
      setError("Failed to load pipeline. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [sort, search, router]);

  useEffect(() => { fetchPipeline(); }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — 🚩 same fix as Contacts: skip this effect's mount-time
  // run since the effect above already fetches on initial load. Without
  // this, every page load fired two requests ~400ms apart (invisible
  // locally, visibly two loading flashes in production).
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    const t = setTimeout(() => fetchPipeline(), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch a contact list once on mount — populates the create-form dropdown
  useEffect(() => {
    const token = localStorage.getItem("crm-token");
    if (!token) return;
    fetch("/api/contacts?limit=100", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setContactOptions(json.data.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  async function handleCreateDeal() {
    setFormError("");
    if (!title.trim()) { setFormError("Title is mandatory"); return; }
    if (!contactId) { setFormError("Contact is mandatory"); return; }
    if (!amount || isNaN(Number(amount))) { setFormError("Amount is mandatory and must be a number"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("crm-token")}` },
        body: JSON.stringify({
          title, contactId, amount: Number(amount), stage,
          expectedCloseDate: expectedCloseDate || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.message ?? "Failed to create deal");
        showToast(json.message ?? "Failed to create deal", "error");
        return;
      }

      setTitle(""); setContactId(""); setAmount(""); setStage("Qualification"); setExpectedCloseDate("");
      setShowForm(false);
      showToast("Deal created successfully");
      fetchPipeline();
    } catch {
      setFormError("Network error. Please try again.");
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteClick() {
    showToast("Delete is not available yet", "info");
  }

  async function handleDrop(newStage: string) {
    setDragOverStage(null);
    if (!draggedId) return;

    const deal = pipeline.find((d) => d.id === draggedId);
    if (!deal || deal.stage === newStage) { setDraggedId(null); return; }

    const token = localStorage.getItem("crm-token");
    setUpdatingId(draggedId);

    // Optimistic update — move the card AND recompute summary immediately,
    // from local state, no server round trip needed for the redraw itself.
    const previousPipeline = pipeline;
    const previousSummary = summary;
    const updatedPipeline = pipeline.map((d) =>
      d.id === draggedId ? { ...d, stage: newStage } : d
    );
    setPipeline(updatedPipeline);
    setSummary(computeSummary(updatedPipeline));

    try {
      const res = await fetch(`/api/deals/${draggedId}/stage`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        // Server rejected it (ownership, invalid stage, etc.) — roll back
        // both the card position and the summary numbers together.
        setPipeline(previousPipeline);
        setSummary(previousSummary);
        setError("Failed to move deal. Please try again.");
        showToast("Failed to move deal. Please try again.", "error");
      } else {
        showToast(`Deal moved to ${newStage}`);
      }
      // On success: nothing further to do — UI already reflects the new
      // state, and the server now agrees with it. No refetch, no flash.
    } catch {
      setPipeline(previousPipeline);
      setSummary(previousSummary);
      setError("Failed to move deal. Please try again.");
      showToast("Failed to move deal. Please try again.", "error");
    } finally {
      setUpdatingId(null);
      setDraggedId(null);
    }
  }

  const dealsByStage = (stage: string) => pipeline.filter((d) => d.stage === stage);
  const summaryFor = (stage: string) => summary.find((s) => s.stage === stage);

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Deals {pipeline.length > 0 && <span style={{ color: "var(--text-muted)" }}>· {pipeline.length}</span>}
          </span>
          <ThemeToggle />
        </div>

        <div className="p-8">
          {/* Controls */}
          <div className="flex items-center justify-between mb-5">
            <div className="relative max-w-xs w-full">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deals..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={sort}
                onChange={(v) => setSort(v as typeof sort)}
                className="w-40"
                options={[
                  { label: "Newest", value: "createdAt" },
                  { label: "Amount", value: "amount" },
                  { label: "Close Date", value: "expectedCloseDate" },
                ]}
              />

              <button
                onClick={() => setShowForm(true)}
                className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                + New Deal
              </button>
            </div>
          </div>

          {/* Create Deal dialog */}
          <Dialog
            open={showForm}
            onClose={() => setShowForm(false)}
            title="New Deal"
            description="Add a new deal to the pipeline."
            footer={
              <>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Cancel
                </button>
                <button
                  onClick={handleCreateDeal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "var(--text)", color: "var(--bg)", opacity: submitting ? 0.5 : 1 }}
                >
                  {submitting ? "Creating..." : "Create Deal"}
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deal title"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
              <Select
                value={contactId}
                onChange={setContactId}
                placeholder="Select contact"
                options={contactOptions.map((c) => ({ label: c.name, value: c.id }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ($)" type="number" min="0"
                  className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }} />
                <Select
                  value={stage}
                  onChange={setStage}
                  options={STAGES.map((s) => ({ label: s, value: s }))}
                />
              </div>
              <DatePicker value={expectedCloseDate} onChange={setExpectedCloseDate} placeholder="Expected close date" />
            </div>
          </Dialog>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg text-xs" style={{
              background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)",
            }}>
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && <LoadingState />}

          {/* Kanban board */}
          {!loading && (
            <div className="grid grid-cols-4 gap-4">
              {STAGES.map((stage) => {
                const stageDeals = dealsByStage(stage);
                const stageSummary = summaryFor(stage);
                const isDragOver = dragOverStage === stage;

                return (
                  <div
                    key={stage}
                    onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={(e) => { e.preventDefault(); handleDrop(stage); }}
                    className="rounded-xl p-3 transition-colors"
                    style={{
                      background: isDragOver ? "var(--bg-subtle)" : "transparent",
                      border: `1px solid ${isDragOver ? "var(--text-muted)" : "var(--border)"}`,
                      minHeight: "60vh",
                    }}
                  >
                    {/* Column header */}
                    <div className="mb-3 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{stage}</span>
                        <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {stageSummary?.count ?? 0}
                        </span>
                      </div>
                      <div className="text-sm font-semibold mt-1" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
                        {formatCurrency(stageSummary?.totalAmount ?? 0)}
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {stageDeals.length === 0 && (
                        <div className="text-xs text-center py-6" style={{ color: "var(--text-faint)" }}>
                          No deals
                        </div>
                      )}

                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => setDraggedId(deal.id)}
                          onDragEnd={() => setDraggedId(null)}
                          className="p-3 rounded-lg cursor-grab active:cursor-grabbing transition-opacity"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                            opacity: updatingId === deal.id ? 0.5 : draggedId === deal.id ? 0.3 : 1,
                          }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                              {deal.title}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
                              aria-label="Delete deal"
                              style={{ color: "var(--text-faint)", flexShrink: 0 }}
                              className="ml-2"
                            >
                              <Trash2 size={12} strokeWidth={1.8} />
                            </button>
                          </div>
                          <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                            {deal.contactName}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                              {formatCurrency(deal.amount)}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {formatDate(deal.expectedCloseDate)}
                            </span>
                          </div>
                          {/* Probability bar */}
                          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${deal.probability}%`, background: "var(--text)" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}