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