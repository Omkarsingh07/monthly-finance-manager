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
  monthlyAllocation?: number;     // Current month's base SIP allocation (S * weightage / 100)
  previousPending?: number;       // Accumulated pending balance from previous months for THIS investment
  availableAmount?: number;       // monthlyAllocation + previousPending
  currentPrice?: number;         // Current unit/share price if provided
  sharesToBuy?: number;          // Whole units/shares: floor(availableAmount / currentPrice)
  plannedPurchaseAmount?: number;// sharesToBuy * currentPrice
  actualAmount: number;          // Actual amount invested this month
  pendingAmount?: number;        // Resulting pending balance: availableAmount - actualAmount

  // Backward-compatibility aliases
  normalPlannedAmount?: number;
  previousMonthPending?: number;
  plannedAmount: number;
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
  totalAvailableAmount?: number;
  currentMonthActual: number;
  currentMonthRemaining: number;
  investments: MonthlyInvestmentItem[];
}
