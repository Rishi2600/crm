"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { DEAL_STAGE_COLOR, DEAL_STATUS_COLOR, FALLBACK_STATUS_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { DealsPipelineResponse, DealCardResponse, DealStageSummary } from "@/types/deals";

interface ContactOption { id: string; name: string; }

const STAGES = ["Qualification", "Proposal", "Negotiation", "Closed Won"];

// Stages whose column header offers a "+" that opens New Deal preset to it.
// Closed Won has none: a deal is won by moving it there, not created there.
const ADDABLE_STAGES = new Set(["Qualification", "Proposal", "Negotiation"]);

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

// FLAG: the pipeline endpoint returns no deal status, and it leaves LOST
// deals out, so the badge is derived from the stage.
function DealStatus({ stage }: { stage: string }) {
  const status = stage === "Closed Won" ? "Won" : "Open";
  return <StatusBadge color={DEAL_STATUS_COLOR[status]}>{status}</StatusBadge>;
}

function DealCard({ deal }: { deal: DealCardResponse }) {
  return (
    <>
      <div className="flex items-start gap-2.5">
        <InitialsAvatar name={deal.contactName} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{deal.title}</div>
          <div className="truncate text-xs text-muted-foreground">{deal.contactName}</div>
        </div>
        <DealStatus stage={deal.stage} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Probability</span>
          <span className="font-medium tabular-nums text-foreground">{deal.probability}%</span>
        </div>
        <Progress value={deal.probability} className="h-1" aria-label={`Probability ${deal.probability}%`} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          {formatDate(deal.expectedCloseDate)}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{formatINR(deal.amount)}</span>
      </div>
    </>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading deals">
      {STAGES.map((stage) => (
        <div key={stage} className="min-h-[60vh] rounded-xl border bg-muted/40 p-3">
          <div className="mb-3 space-y-2 border-b pb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-1 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DealsPage() {
  const router = useRouter();
  // FLAG: only used for the backward-move validation message — every other
  // Deals action (create, drag success, network errors) still uses the
  // inline setError banner, per the earlier decision to remove toast from
  // this page. This one case is narrow: the message needs to auto-clear
  // (a persistent banner that survives until reload is worse UX for a
  // "you did something invalid, here's why" message than for a real error).
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

  // Debounce search — FLAG: same fix as Contacts: skip this effect's mount-time
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
      .then((json: { data: ContactOption[] } | null) => {
        if (json) setContactOptions(json.data.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, []);

  function openFormAt(presetStage: string) {
    setStage(presetStage);
    setShowForm(true);
  }

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
        return;
      }

      setTitle(""); setContactId(""); setAmount(""); setStage("Qualification"); setExpectedCloseDate("");
      setShowForm(false);
      fetchPipeline();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDrop(newStage: string) {
    setDragOverStage(null);
    if (!draggedId) return;

    const deal = pipeline.find((d) => d.id === draggedId);
    if (!deal || deal.stage === newStage) { setDraggedId(null); return; }

    // Defensive duplicate of the same check the onDrop handler already does
    // before calling this function — kept here too since handleDrop is the
    // one function actually talking to the server, and shouldn't assume its
    // only caller got the check right.
    if (STAGES.indexOf(newStage) < STAGES.indexOf(deal.stage)) {
      setDraggedId(null);
      showToast(`Can't move from ${deal.stage} to ${newStage}`, "error");
      return;
    }

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
      }
      // On success: nothing further to do — UI already reflects the new
      // state, and the server now agrees with it. No refetch, no flash.
    } catch {
      setPipeline(previousPipeline);
      setSummary(previousSummary);
      setError("Failed to move deal. Please try again.");
    } finally {
      setUpdatingId(null);
      setDraggedId(null);
    }
  }

  const dealsByStage = (stage: string) => pipeline.filter((d) => d.stage === stage);
  const summaryFor = (stage: string) => summary.find((s) => s.stage === stage);

  return (
    <>
        <PageHeader
          title={
            <span className="font-medium text-foreground">
              Deals {pipeline.length > 0 && <span className="text-muted-foreground">· {pipeline.length}</span>}
            </span>
          }
        />

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search deals..."
              className="max-w-xs"
            />

            <div className="flex items-center gap-2">
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

              <Button onClick={() => setShowForm(true)} className="whitespace-nowrap">
                <Plus aria-hidden />
                New Deal
              </Button>
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
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDeal} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Deal"}
                </Button>
              </>
            }
          >
            {formError && <ErrorBanner className="mb-4">{formError}</ErrorBanner>}
            <div className="space-y-4">
              <FormField label="Title" htmlFor="deal-title">
                <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deal title" />
              </FormField>
              <FormField label="Contact" htmlFor="deal-contact">
                <Select
                  id="deal-contact"
                  value={contactId}
                  onChange={setContactId}
                  placeholder="Select contact"
                  options={contactOptions.map((c) => ({ label: c.name, value: c.id }))}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* FLAG: the "$" placeholder is a known issue (PROJECT_CONTEXT §17), left as is. */}
                <FormField label="Amount" htmlFor="deal-amount">
                  <Input id="deal-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ($)" type="number" min="0" />
                </FormField>
                <FormField label="Stage" htmlFor="deal-stage">
                  <Select
                    id="deal-stage"
                    value={stage}
                    onChange={setStage}
                    options={STAGES.map((s) => ({ label: s, value: s }))}
                  />
                </FormField>
              </div>
              <FormField label="Expected close date" htmlFor="deal-close-date">
                <DatePicker id="deal-close-date" value={expectedCloseDate} onChange={setExpectedCloseDate} placeholder="Expected close date" />
              </FormField>
            </div>
          </Dialog>

          {/* Error */}
          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Loading */}
          {loading && <BoardSkeleton />}

          {/* Kanban board */}
          {!loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((stage) => {
                const stageDeals = dealsByStage(stage);
                const stageSummary = summaryFor(stage);
                const isDragOver = dragOverStage === stage;

                // Forward-only movement — a column is a valid drop target
                // only if its stage index is >= the dragged deal's current
                // stage index. Checked here too (not just server-side) so
                // invalid columns visibly don't highlight during drag,
                // rather than letting the drop appear to succeed and then
                // silently reverting after a rejected request.
                const draggedDeal = pipeline.find((d) => d.id === draggedId);
                const isValidTarget = !draggedDeal || STAGES.indexOf(stage) >= STAGES.indexOf(draggedDeal.stage);

                return (
                  <section
                    key={stage}
                    aria-label={stage}
                    onDragOver={(e) => { e.preventDefault(); if (isValidTarget) setDragOverStage(stage); }}
                    onDragLeave={() => setDragOverStage(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!isValidTarget) {
                        setDragOverStage(null);
                        showToast(`Can't move from ${draggedDeal?.stage} to ${stage}`, "error");
                        return;
                      }
                      handleDrop(stage);
                    }}
                    className={cn(
                      "min-h-[60vh] min-w-0 rounded-xl border p-3 transition-[background-color,border-color,opacity]",
                      isDragOver ? "border-muted-foreground bg-muted" : "bg-muted/40",
                      draggedId && !isValidTarget && "opacity-50"
                    )}
                  >
                    {/* Column header */}
                    <div className="mb-3 border-b pb-3">
                      {/* min-h keeps Closed Won, which has no "+", level with the rest. */}
                      <div className="flex min-h-7 items-center justify-between gap-2">
                        <h2 className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: DEAL_STAGE_COLOR[stage] ?? FALLBACK_STATUS_COLOR }}
                            aria-hidden
                          />
                          <span className="truncate">{stage}</span>
                          <Badge variant="secondary" className="px-1.5 py-0 font-medium tabular-nums">
                            {stageSummary?.count ?? 0}
                          </Badge>
                        </h2>
                        {ADDABLE_STAGES.has(stage) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() => openFormAt(stage)}
                            aria-label={`New deal in ${stage}`}
                          >
                            <Plus aria-hidden />
                          </Button>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-semibold tracking-tight text-foreground">
                        {formatINR(stageSummary?.totalAmount ?? 0)}
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {stageDeals.length === 0 && (
                        <div className="py-6 text-center text-xs text-faint">
                          No deals
                        </div>
                      )}

                      {stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={() => setDraggedId(deal.id)}
                          onDragEnd={() => setDraggedId(null)}
                          className={cn(
                            "cursor-grab rounded-lg border bg-card p-3 transition-opacity active:cursor-grabbing",
                            updatingId === deal.id ? "opacity-50" : draggedId === deal.id && "opacity-30"
                          )}
                        >
                          <DealCard deal={deal} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
    </>
  );
}
