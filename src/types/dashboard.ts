// src/types/dashboard.ts

// ─── API Response Types ───────────────────────────────────────────────────────

export interface RevenueData {
  amount: number;
  growth: number; // percentage vs previous month
}

export interface GraphPoint {
  month: string;  // "Jan", "Feb", ...
  value: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  amount: number;
}

export interface ActivityItem {
  id: string;
  activityType: string;
  entityType: string;
  message: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export interface DashboardResponse {
  revenue: RevenueData;
  activeDeals: number;
  contacts: number;
  conversionRate: number;
  revenueGraph: GraphPoint[];
  dealsGraph: GraphPoint[];
  pipeline: PipelineStage[];
  activities: ActivityItem[];
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
}
