// src/types/api.ts

export type InvestmentCategory = 'STOCK' | 'ETF' | 'MUTUAL_FUND' | 'OTHER';

export interface PlanInvestmentItem {
  id: string;
  name: string;
  category: InvestmentCategory;
  weightage: number;
}

export interface MonthlyInvestmentItem {
  id: string; // planInvestmentId
  name: string;
  category: InvestmentCategory;
  weightage: number;
  normalPlannedAmount?: number;
  previousMonthPending?: number;
  plannedAmount: number;
  actualAmount: number;
}

export interface DashboardResponse {
  noPlan: boolean;
  message?: string;
  month: number;
  year: number;
  totalInvestment: number;
  baseMonthlyAmount: number;
  previousCarryForward: number;
  currentMonthTarget: number;
  currentMonthActual: number;
  currentMonthRemaining: number;
  investments: MonthlyInvestmentItem[];
}
