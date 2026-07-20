"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Select from "@/components/ui/Select";
import LoadingState from "@/components/ui/LoadingState";
import { ContactsApiResponse, ContactResponse } from "@/types/contacts";

const STATUS_COLOR: Record<string, string> = {
  Hot: "var(--red)",
  Warm: "#d97706",
  Cold: "var(--text-muted)",
};

function formatCurrency(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"name" | "dealValue" | "createdAt">("createdAt");

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
  // 🚩 Previously this fired unconditionally on mount too (React runs every
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

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Contacts {total > 0 && <span style={{ color: "var(--text-muted)" }}>· {total}</span>}
          </span>
          <ThemeToggle />
        </div>

        <div className="p-8">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-5">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
            </div>

            {/* Sort */}
            <Select
              value={sort}
              onChange={(v) => { setSort(v as typeof sort); setPage(1); }}
              className="w-40"
              options={[
                { label: "Newest", value: "createdAt" },
                { label: "Name", value: "name" },
                { label: "Deal Value", value: "dealValue" },
              ]}
            />
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {/* Header row */}
            <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium" style={{
              background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)",
            }}>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Company</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2 text-right">Deal Value</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-center">★</div>
            </div>

            {/* Loading */}
            {loading && <LoadingState variant="inline" />}

            {/* Error */}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: "var(--red)" }}>
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && contacts.length === 0 && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No Contacts Found
              </div>
            )}

            {/* Rows */}
            {!loading && !error && contacts.map((c, i) => (
              <div
                key={c.id}
                className="grid grid-cols-12 px-4 py-3 text-sm items-center"
                style={{ borderBottom: i < contacts.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="col-span-3">
                  <div style={{ color: "var(--text)" }}>{c.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.email}</div>
                </div>
                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.company ?? "—"}
                </div>
                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  {c.location ?? "—"}
                </div>
                <div className="col-span-2 text-right text-sm font-medium tabular-nums" style={{ color: "var(--text)" }}>
                  {formatCurrency(c.dealValue)}
                </div>
                <div className="col-span-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                    style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[c.status] }} />
                    <span style={{ color: "var(--text)" }}>{c.status}</span>
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  <span style={{ color: c.isFavourite ? "#d97706" : "var(--text-faint)" }}>★</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {!loading && !error && total > 0 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Page {page} of {totalPages}
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
      </main>
    </div>
  );
}