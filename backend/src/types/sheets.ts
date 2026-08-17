// src/types/sheets.ts

export type InvestmentCategory = 'STOCK' | 'ETF' | 'MUTUAL_FUND' | 'OTHER';

export interface InvestmentPlanRecord {
  id: string; // e.g. "pi_001" or uuid
  name: string;
  category: InvestmentCategory;
  weightage: number; // e.g. 40
  effectiveFromMonth: number; // 1-12
  effectiveFromYear: number;
  planVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SettingRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export interface MonthlyInvestmentRecord {
  id: string; // e.g. "mi_001" or uuid
  planInvestmentId: string;
  year: number;
  month: number; // 1-12
  actualAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanHistoryRecord {
  planVersion: number;
  monthlyInvestmentAmount: number;
  effectiveFromMonth: number;
  effectiveFromYear: number;
  createdAt: string;
}
