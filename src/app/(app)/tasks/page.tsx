"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import Dialog from "@/components/common/Dialog";
import ErrorBanner from "@/components/common/ErrorBanner";
import FormField from "@/components/common/FormField";
import InitialsAvatar from "@/components/common/InitialsAvatar";
import RevealOnHover, { RevealLine } from "@/components/common/RevealOnHover";
import RowActionsMenu from "@/components/common/RowActionsMenu";
import SearchInput from "@/components/common/SearchInput";
import StatusBadge from "@/components/common/StatusBadge";
import { TableMessageRow, TableSkeletonRows } from "@/components/common/TableStates";
import { PRIORITY_COLOR } from "@/components/common/statusColors";
import { useToast } from "@/components/common/Toast";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksApiResponse, TaskResponse, AssignableUser } from "@/types/tasks";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "inprogress" },
  { label: "Completed", value: "completed" },
];

const TABLE_COLUMNS = 7;

const STATUS_OPTIONS = ["To Do", "In Progress", "Completed"];

function formatDate(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TasksPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();
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

  // Debounced search — FLAG: same fix as Contacts/Deals: skip the mount-time
  // run, since the effect above already fetches on initial load.
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
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
        showToast(json.message ?? "Failed to create task", "error");
        return;
      }

      // Reset form + close it, then refresh the list
      setTitle(""); setDescription(""); setPriority("Medium"); setDueDate("");
      setShowForm(false);
      showToast("Task created successfully");
      fetchTasks();
    } catch {
      setFormError("Network error. Please try again.");
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTask(taskId: string, taskTitle: string) {
    const confirmed = await confirm({
      title: "Delete task",
      message: `Delete "${taskTitle}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.message ?? "Failed to delete task", "error");
        return;
      }
      showToast("Task deleted successfully");
      fetchTasks();
    } catch {
      showToast("Network error. Please try again.", "error");
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
        showToast("Failed to update task status.", "error");
      } else {
        showToast(`Task marked as ${newStatus}`);
      }
    } catch {
      setTasks(previous);
      setError("Failed to update task status.");
      showToast("Failed to update task status.", "error");
    }
  }

  return (
    <>
        <PageHeader
          title={
            <span className="font-medium text-foreground">
              Tasks {total > 0 && <span className="text-muted-foreground">· {total}</span>}
            </span>
          }
        >
          <Button size="sm" onClick={() => setShowForm(true)} aria-label="New Task">
            <Plus aria-hidden />
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </PageHeader>

        {/* One panel whose value always follows the filter: the tabs only
            change the query, so there is a single table to show. */}
        <Tabs value={filter} onValueChange={setFilter} className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="h-auto flex-wrap">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tasks..."
              className="sm:w-56"
            />
          </div>

          {/* Create Task dialog — built as a generic, reusable Dialog so the
              same component powers future forms (e.g. bulk upload of tasks
              or deals) without rebuilding this modal pattern each time. */}
          <Dialog
            open={showForm}
            onClose={() => setShowForm(false)}
            title="New Task"
            description="Create and assign a task to yourself or a direct report."
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} disabled={submitting}>
                  {submitting ? "Creating..." : "Create Task"}
                </Button>
              </>
            }
          >
            {formError && <ErrorBanner className="mb-4">{formError}</ErrorBanner>}
            <div className="space-y-4">
              <FormField label="Title" htmlFor="task-title">
                <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
              </FormField>
              <FormField label="Description" htmlFor="task-description">
                <Input
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Priority" htmlFor="task-priority">
                  <Select
                    id="task-priority"
                    value={priority}
                    onChange={setPriority}
                    options={[
                      { label: "High", value: "High" },
                      { label: "Medium", value: "Medium" },
                      { label: "Low", value: "Low" },
                    ]}
                  />
                </FormField>
                <FormField label="Due date" htmlFor="task-due-date">
                  <DatePicker id="task-due-date" value={dueDate} onChange={setDueDate} placeholder="Due date" />
                </FormField>
              </div>
              <FormField label="Assign to" htmlFor="task-assignee">
                <Select
                  id="task-assignee"
                  value={assignedTo}
                  onChange={setAssignedTo}
                  options={assignableUsers.map((u) => ({ label: u.name, value: u.id }))}
                />
              </FormField>
            </div>
          </Dialog>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {/* Task list */}
          <TabsContent value={filter} className="mt-0">
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="px-4 text-xs">Task</TableHead>
                    <TableHead className="px-4 text-xs">Assigned To</TableHead>
                    <TableHead className="px-4 text-xs">Related Deal</TableHead>
                    <TableHead className="px-4 text-xs">Priority</TableHead>
                    <TableHead className="px-4 text-xs">Due</TableHead>
                    <TableHead className="px-4 text-xs">Status</TableHead>
                    <TableHead className="px-4 text-right text-xs">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableSkeletonRows columns={TABLE_COLUMNS} />}

                  {!loading && tasks.length === 0 && (
                    <TableMessageRow colSpan={TABLE_COLUMNS}>No tasks found</TableMessageRow>
                  )}

                  {!loading && tasks.map((t) => (
                    <TableRow key={t.id} className="group/row">
                      <TableCell className="max-w-[320px] px-4 py-3">
                        <RevealOnHover primary={<span className="font-medium">{t.title}</span>}>
                          {t.description ? <RevealLine>{t.description}</RevealLine> : null}
                        </RevealOnHover>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                          <InitialsAvatar name={t.assignedTo} className="size-6" />
                          <span className="truncate">{t.assignedTo}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate px-4 py-3 text-xs text-muted-foreground">
                        {t.relatedDeal ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge color={PRIORITY_COLOR[t.priority]}>{t.priority}</StatusBadge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(t.dueDate)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Select
                          value={t.status}
                          onChange={(v) => handleStatusChange(t.id, v)}
                          options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <RowActionsMenu label={`Actions for ${t.title}`}>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <ListChecks aria-hidden />
                              Change status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-40">
                              <DropdownMenuRadioGroup
                                value={t.status}
                                onValueChange={(v) => {
                                  // Same rule as the select beside it: only a
                                  // real change is sent.
                                  if (v !== t.status) handleStatusChange(t.id, v);
                                }}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <DropdownMenuRadioItem key={s} value={s}>{s}</DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => handleDeleteTask(t.id, t.title)}
                            className="text-danger focus:text-danger"
                          >
                            <Trash2 aria-hidden />
                            Delete task
                          </DropdownMenuItem>
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* FLAG: this page asks for at most 50 tasks and never sends a
                  `page` parameter (the API accepts one, but adding it would
                  change the page's request), so the footer states the count
                  only. */}
              {!loading && total > 0 && (
                <div className="border-t px-4 py-3 text-xs text-muted-foreground">
                  Showing {tasks.length} of {total}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
    </>
  );
}
