// src/types/analytics.ts

export interface AnalyticsKPIs {
  averageDealSize: number;
  winRate: number;        // percentage
  salesCycle: number;     // average days to close
  activeLeads: number;
}

export interface MonthlyRevenuePoint {
  month: string;
  amount: number;
}

export interface GrowthPoint {
  month: string;
  deals: number;
  contacts: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface TopPerformer {
  name: string;
  closedDeals: number;
  revenue: number;
}

export interface AnalyticsDashboardResponse {
  kpis: AnalyticsKPIs;
  revenueTrend: MonthlyRevenuePoint[];
  growth: GrowthPoint[];
  salesFunnel: FunnelStage[];
  topPerformers: TopPerformer[];
}