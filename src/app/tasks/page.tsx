"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Select from "@/components/ui/Select";
import DatePicker from "@/components/ui/DatePicker";
import LoadingState from "@/components/ui/LoadingState";
import { TasksApiResponse, TaskResponse, AssignableUser } from "@/types/tasks";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "inprogress" },
  { label: "Completed", value: "completed" },
];

const PRIORITY_COLOR: Record<string, string> = {
  High: "var(--red)",
  Medium: "#d97706",
  Low: "var(--text-muted)",
};

const STATUS_OPTIONS = ["To Do", "In Progress", "Completed"];

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create-form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [formError, setFormError] = useState("");

  const token = () => localStorage.getItem("crm-token");

  const fetchTasks = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({ limit: "50" });
    if (filter !== "all") params.set("status", filter);
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await fetch(`/api/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok) throw new Error("Failed to fetch");

      const json: TasksApiResponse = await res.json();
      setTasks(json.data);
      setTotal(json.total);
    } catch {
      setError("Failed to load tasks. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [filter, search, router]);

  const fetchAssignableUsers = useCallback(async () => {
    const t = token();
    if (!t) return;
    try {
      const res = await fetch("/api/users/assignable", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const json = await res.json();
        setAssignableUsers(json.data);
        if (json.data.length > 0) setAssignedTo(json.data[0].id);
      }
    } catch {
      // non-fatal — form will just show an empty dropdown
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAssignableUsers(); }, [fetchAssignableUsers]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchTasks(), 400);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateTask() {
    setFormError("");

    if (!title.trim()) { setFormError("Title is mandatory"); return; }
    if (!dueDate) { setFormError("Due Date is mandatory"); return; }
    if (!assignedTo) { setFormError("Assigned User is mandatory"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title, description, priority, dueDate, assignedTo }),
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.message ?? "Failed to create task");
        return;
      }

      // Reset form + close it, then refresh the list
      setTitle(""); setDescription(""); setPriority("Medium"); setDueDate("");
      setShowForm(false);
      fetchTasks();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    // Optimistic — flip it locally first, no full-list reload/flash.
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks(previous); // roll back on rejection (ownership, invalid status, etc.)
        setError("Failed to update task status.");
      }
    } catch {
      setTasks(previous);
      setError("Failed to update task status.");
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <main className="flex-1 ml-52 min-h-screen">
        <div className="h-14 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            Tasks {total > 0 && <span style={{ color: "var(--text-muted)" }}>· {total}</span>}
          </span>
          <ThemeToggle />
        </div>

        <div className="p-8">
          {/* Controls */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: filter === f.value ? "var(--bg-card)" : "transparent",
                    color: filter === f.value ? "var(--text)" : "var(--text-muted)",
                    border: filter === f.value ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="px-3 py-2 rounded-lg text-sm w-56"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
              />
              <button
                onClick={() => setShowForm((s) => !s)}
                className="px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)" }}
              >
                {showForm ? "Cancel" : "+ New Task"}
              </button>
            </div>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="mb-5 p-4 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {formError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--red)" }}>
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  className="px-3 py-2 rounded-lg text-sm col-span-2"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="px-3 py-2 rounded-lg text-sm col-span-2"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                />
                <Select
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { label: "High", value: "High" },
                    { label: "Medium", value: "Medium" },
                    { label: "Low", value: "Low" },
                  ]}
                />
                <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
                <Select
                  value={assignedTo}
                  onChange={setAssignedTo}
                  className="col-span-2"
                  options={assignableUsers.map((u) => ({ label: u.name, value: u.id }))}
                />
              </div>
              <button
                onClick={handleCreateTask}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ background: "var(--text)", color: "var(--bg)", opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? "Creating..." : "Create Task"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--red)" }}>
              {error}
            </div>
          )}

          {/* Task list */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium" style={{
              background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)",
            }}>
              <div className="col-span-4">Task</div>
              <div className="col-span-2">Assigned To</div>
              <div className="col-span-2">Related Deal</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-1">Due</div>
              <div className="col-span-2">Status</div>
            </div>

            {loading && <LoadingState variant="inline" label="Loading tasks..." />}

            {!loading && tasks.length === 0 && (
              <div className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>No tasks found</div>
            )}

            {!loading && tasks.map((t, i) => (
              <div
                key={t.id}
                className="grid grid-cols-12 px-4 py-3 text-sm items-center"
                style={{ borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div className="col-span-4">
                  <div style={{ color: "var(--text)" }}>{t.title}</div>
                  {t.description && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{t.description}</div>
                  )}
                </div>
                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>{t.assignedTo}</div>
                <div className="col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>{t.relatedDeal ?? "—"}</div>
                <div className="col-span-1">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] }} />
                    {t.priority}
                  </span>
                </div>
                <div className="col-span-1 text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(t.dueDate)}</div>
                <div className="col-span-2">
                  <Select
                    value={t.status}
                    onChange={(v) => handleStatusChange(t.id, v)}
                    options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}