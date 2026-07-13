// src/types/tasks.ts

// ─── Single Task Shape (as returned to frontend) ─────────────────────────────

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  priority: string;          // "High" | "Medium" | "Low"
  status: string;            // "To Do" | "In Progress" | "Completed"
  type: string;              // "Standard" | "Meeting"
  dueDate: string | null;    // ISO date
  assignedTo: string;        // assignee's name
  relatedDeal: string | null; // deal title, or null
}

// ─── API Envelope (list endpoint) ─────────────────────────────────────────────

export interface TasksApiResponse {
  success: boolean;
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: TaskResponse[];
}

// ─── Create Task Payload ──────────────────────────────────────────────────────

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: string;         // "High" | "Medium" | "Low" — defaults to Medium if omitted
  dueDate: string;           // mandatory per story
  assignedTo: string;        // mandatory per story
  relatedDealId?: string;
  // Meeting fields — only required/used when type === "Meeting". The story
  // never specifies a dedicated endpoint/payload for saving these (only
  // attendees get an explicit "Save Meeting Attendees" API) — filling that
  // gap by accepting them directly on task creation instead of inventing a
  // separate unspecified endpoint.
  type?: string;             // "Standard" | "Meeting" — defaults to Standard
  meetingDate?: string;
  meetingTime?: string;
  location?: string;
  notes?: string;
}

export interface CreateTaskResponse {
  success: boolean;
  message: string;
  data: TaskResponse;
}

// ─── Assignable Users (for the "Assign To" dropdown) ─────────────────────────

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
}

export interface AssignableUsersResponse {
  success: boolean;
  data: AssignableUser[];
}

// ─── Status Update ─────────────────────────────────────────────────────────────

export interface StatusUpdatePayload {
  status: string; // "To Do" | "In Progress" | "Completed"
}

// ─── Meeting Attendees ─────────────────────────────────────────────────────────

export interface SaveAttendeesPayload {
  attendees: string[]; // contact IDs
}