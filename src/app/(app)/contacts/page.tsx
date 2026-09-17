"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FollowUpFields from "@/components/common/FollowUpFields";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import PaginationFooter from "@/components/common/PaginationFooter";
import RevealOnHover, { RevealLine } from "@/components/common/RevealOnHover";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { TableMessageRow, TableSkeletonRows } from "@/components/common/TableStates";
import { TEMPERATURE_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/currency";
import { ContactsApiResponse, ContactResponse } from "@/types/contacts";

const TABLE_COLUMNS = 7;

export default function ContactsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"name" | "dealValue" | "createdAt">("createdAt");

  // Create Contact dialog
  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [leadStatus, setLeadStatus] = useState("Warm");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Schedule-follow-up dialog — the entry point for "an agent sets a
  // follow-up on a lead". Posts to the same /api/follow-ups endpoint the
  // Follow-up page reads, so anything set here shows up there immediately.
  const [followUpFor, setFollowUpFor] = useState<ContactResponse | null>(null);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("09:00");
  const [fuNotes, setFuNotes] = useState("");
  const [fuError, setFuError] = useState("");
  const [fuSubmitting, setFuSubmitting] = useState(false);

  const fetchContacts = useCallback(async () => {
    const token = localStorage.getItem("crm-token");
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      sort,
    });
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: ContactsApiResponse = await res.json();
      setContacts(json.data);
      setTotalPages(json.totalPages);
      setTotal(json.total);
    } catch {
      setError("Failed to load contacts. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, router]);

  // Refetch on page/sort change (this ALSO covers the very first load — see
  // the note below on why the search effect must not duplicate that).
  useEffect(() => { fetchContacts(); }, [page, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — refetch 400ms after user stops typing.
  // FLAG: previously this fired unconditionally on mount too (React runs every
  // effect at least once after the first render, regardless of dependency
  // values), causing a genuine SECOND fetch ~400ms after the first one on
  // every page load — not a dev/prod difference, a real duplicate request
  // in both environments. It only became visually obvious in production
  // because real network/DB latency stretched the two requests far enough
  // apart to show two distinct loading flashes; locally both resolved fast
  // enough to look like one smooth load. The isFirstRun ref below skips
  // this effect's initial invocation, since the effect above already
  // handles the mount-time fetch.
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      setPage(1);
      fetchContacts();
    }, 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateContact() {
    setFormError("");
    if (!firstName.trim()) { setFormError("First name is mandatory"); return; }
    if (!lastName.trim()) { setFormError("Last name is mandatory"); return; }
    if (!email.trim()) { setFormError("Email is mandatory"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("crm-token")}` },
        body: JSON.stringify({
          firstName, lastName, email, phone: phone || undefined,
          location: location || undefined, companyName: companyName || undefined, leadStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.message ?? "Failed to create contact");
        showToast(json.message ?? "Failed to create contact", "error");
        return;
      }

      setFirstName(""); setLastName(""); setEmail(""); setPhone("");
      setLocation(""); setCompanyName(""); setLeadStatus("Warm");
      setShowForm(false);
      showToast("Contact created successfully");
      fetchContacts();
    } catch {
      setFormError("Network error. Please try again.");
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function openFollowUp(contact: ContactResponse) {
    setFollowUpFor(contact);
    setFuDate("");
    setFuTime("09:00");
    setFuNotes("");
    setFuError("");
  }

  async function handleScheduleFollowUp() {
    setFuError("");
    if (!followUpFor) return;
    if (!fuDate) { setFuError("Follow-up date is mandatory"); return; }

    setFuSubmitting(true);
    try {
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("crm-token")}` },
        body: JSON.stringify({
          contactId: followUpFor.id,
          scheduledDate: fuDate,
          scheduledTime: fuTime || undefined,
          notes: fuNotes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFuError(json.message ?? "Failed to schedule follow-up");
        return;
      }

      setFollowUpFor(null);
      showToast("Follow-up scheduled successfully");
    } catch {
      setFuError("Network error. Please try again.");
    } finally {
      setFuSubmitting(false);
    }
  }

  return (
    <>
        <PageHeader
          title={
            <span className="font-medium text-foreground">
              Contacts {total > 0 && <span className="text-muted-foreground">· {total}</span>}
            </span>
          }
        >
          <Button size="sm" onClick={() => setShowForm(true)} aria-label="New Contact">
            <Plus aria-hidden />
            <span className="hidden sm:inline">New Contact</span>
          </Button>
        </PageHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search contacts..."
              className="max-w-xs"
            />

            <Select
              value={sort}
              onChange={(v) => { setSort(v as typeof sort); setPage(1); }}
              className="w-40"
              align="right"
              options={[
                { label: "Newest", value: "createdAt" },
                { label: "Name", value: "name" },
                { label: "Deal Value", value: "dealValue" },
              ]}
            />
          </div>

          {/* Create Contact dialog — same reusable Dialog used for Tasks */}
          <Dialog
            open={showForm}
            onClose={() => setShowForm(false)}
            title="New Contact"
            description="Add a new contact to the CRM."
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateContact} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Contact"}
                </Button>
              </>
            }
          >
            {formError && <ErrorBanner className="mb-4">{formError}</ErrorBanner>}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="First name" htmlFor="contact-first-name">
                  <Input id="contact-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </FormField>
                <FormField label="Last name" htmlFor="contact-last-name">
                  <Input id="contact-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </FormField>
              </div>
              <FormField label="Email" htmlFor="contact-email">
                <Input id="contact-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Phone" htmlFor="contact-phone">
                  <Input id="contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                </FormField>
                <FormField label="Location" htmlFor="contact-location">
                  <Input id="contact-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Company" htmlFor="contact-company">
                  <Input id="contact-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Optional" />
                </FormField>
                <FormField label="Temperature" htmlFor="contact-temperature">
                  <Select
                    id="contact-temperature"
                    value={leadStatus}
                    onChange={setLeadStatus}
                    options={[
                      { label: "Hot", value: "Hot" },
                      { label: "Warm", value: "Warm" },
                      { label: "Cold", value: "Cold" },
                    ]}
                  />
                </FormField>
              </div>
            </div>
          </Dialog>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-4 text-xs">Name</TableHead>
                  <TableHead className="px-4 text-xs">Company</TableHead>
                  <TableHead className="px-4 text-xs">Location</TableHead>
                  <TableHead className="px-4 text-right text-xs">Deal Value</TableHead>
                  <TableHead className="px-4 text-xs">Status</TableHead>
                  <TableHead className="px-4 text-center text-xs">
                    <Star className="mx-auto size-3.5" aria-hidden />
                    <span className="sr-only">Favourite</span>
                  </TableHead>
                  <TableHead className="px-4 text-right text-xs">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows columns={TABLE_COLUMNS} rows={10} />}

                {!loading && !error && contacts.length === 0 && (
                  <TableMessageRow colSpan={TABLE_COLUMNS}>No Contacts Found</TableMessageRow>
                )}

                {!loading && !error && contacts.map((c) => (
                  <TableRow key={c.id} className="group/row">
                    <TableCell className="max-w-[280px] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <InitialsAvatar name={c.name} />
                        <div className="min-w-0 flex-1 pt-1">
                          <RevealOnHover primary={<span className="font-medium">{c.name}</span>}>
                            <RevealLine>{c.email}</RevealLine>
                          </RevealOnHover>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {c.company ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {c.location ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                      {formatINR(c.dealValue)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge color={TEMPERATURE_COLOR[c.status]}>{c.status}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {/* Display only — there is no endpoint to change it. */}
                      <Star
                        role="img"
                        aria-label={c.isFavourite ? "Favourite" : "Not a favourite"}
                        className={cn(
                          "mx-auto size-4",
                          c.isFavourite ? "fill-amber-500 text-amber-500" : "text-faint"
                        )}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => openFollowUp(c)}
                        aria-label={`Schedule follow-up with ${c.name}`}
                        title="Schedule follow-up"
                      >
                        <CalendarClock aria-hidden />
                      </Button>
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

        {/* Schedule follow-up on a lead */}
        <Dialog
          open={!!followUpFor}
          onClose={() => setFollowUpFor(null)}
          title="Schedule follow-up"
          description={followUpFor ? `Set a follow-up with ${followUpFor.name}.` : ""}
          footer={
            <>
              <Button variant="ghost" onClick={() => setFollowUpFor(null)}>
                Cancel
              </Button>
              <Button onClick={handleScheduleFollowUp} disabled={fuSubmitting}>
                {fuSubmitting ? "Scheduling..." : "Schedule"}
              </Button>
            </>
          }
        >
          {fuError && <ErrorBanner className="mb-4">{fuError}</ErrorBanner>}
          <FollowUpFields
            idPrefix="contact-follow-up"
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
