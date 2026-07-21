// src/types/contacts.ts

// ─── Single Contact Shape (as returned to frontend) ──────────────────────────

export interface ContactResponse {
  id: string;
  name: string;           // firstName + lastName, combined server-side
  company: string | null; // Company.companyName, joined
  email: string;
  phone: string | null;
  location: string | null;
  dealValue: number;      // computed — SUM(Deal.amount) for this contact
  status: string;         // leadStatus: "Hot" | "Warm" | "Cold"
  isFavourite: boolean;
}

// ─── API Envelope ─────────────────────────────────────────────────────────────

export interface ContactsApiResponse {
  success: boolean;
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: ContactResponse[];
}

// ─── Query Params (from URL search params) ───────────────────────────────────

export interface ContactsQueryParams {
  search?: string;
  page?: number;
  limit?: number;
  sort?: "name" | "dealValue" | "createdAt";
}

// ─── Create Contact Payload ───────────────────────────────────────────────────

export interface CreateContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyId?: string;
  location?: string;
  leadStatus?: string; // "Hot" | "Warm" | "Cold" — defaults to Warm
  isFavourite?: boolean;
  ownerId?: string; // defaults to creator — only ADMIN/MANAGER may override, and only within their hierarchy
}

export interface CreateContactResponse {
  success: boolean;
  message: string;
  data: ContactResponse;
}